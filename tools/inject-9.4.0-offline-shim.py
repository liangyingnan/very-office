#!/usr/bin/env python3
"""inject-9.4.0-offline-shim.py — 为 9.4.0 sdk-all-min.js 注入离线支撑 shim（幂等）

功能：
  1. AscCommon.fetchFonts —— x2t_helper.convertFromBin 转换时向 wasm MEMFS 提供字体
     （XHR 拉取 vendor/fonts/<id>，按 16 字节密钥 XOR 解密前 32 字节）
  2. visio 额外注入 compareVersions + 本地许可补丁（word/cell/slide 已有）
  3. 重建 .br / .gz 压缩产物

用法：
  python tools/inject-9.4.0-offline-shim.py [--product word|cell|slide|visio]...
  python tools/inject-9.4.0-offline-shim.py            # 全部产品

幂等：以 __ooFetchFontsPatched / __ooOfflineLicensePatched marker 检测，重复执行安全。
"""
import os
import sys
import shutil
import argparse
import gzip
import subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SDKJS = os.path.join(ROOT, '9.4.0', 'vendor', 'sdkjs')
PRODUCTS = ['word', 'cell', 'slide', 'visio']

# ---------------------------------------------------------------------------
# fetchFonts：x2t 转换时把字体喂给 wasm MEMFS（/working/fonts/）
# 结构依据（9.4.0 sdk-all.js）：
#   AscCommon.g_font_loader.fontFilesPath = "../../../../fonts/"
#   AscCommon.g_font_loader.fontFiles[i]  = CFontFileLoader（.Id = "000"）
#   AscCommon.g_font_loader.fontInfos[i]  = CFontInfo（Name/indexR/indexI/indexB/indexBI）
# fonts 目录文件按 16 字节密钥 XOR 混淆前 32 字节
# ---------------------------------------------------------------------------
FETCH_FONTS_SHIM = """;(function(){var w=window;
try{
if(!w.AscCommon||w.AscCommon.fetchFonts)return;
var KEY=[160,102,214,32,20,150,71,250,149,105,184,80,176,65,73,72];
var STYLES=[['indexR',''],['indexB','_Bold'],['indexBI','_Bold_Italic'],['indexI','_Italic']];
var cache=w.__ooFontCache||(w.__ooFontCache={});
w.AscCommon.fetchFonts=function(cb){
    var loader=w.AscCommon.g_font_loader;
    var files=loader&&loader.fontFiles;
    var infos=loader&&loader.fontInfos;
    var base=(loader&&loader.fontFilesPath)||'../../../../fonts/';
    if(!files||!infos){if(cb)cb([]);return;}
    var out=[],pending=0;
    function done(){if(--pending===0&&cb){cb(out)}}
    function load(url,name){
        pending++;
        var xhr=new XMLHttpRequest();
        xhr.open('GET',url,true);
        if(typeof ArrayBuffer!=='undefined'&&!w.opera){xhr.responseType='arraybuffer'}
        xhr.onload=function(){
            if(this.status!==200||!this.response){done();return}
            var bytes=new Uint8Array(this.response);
            for(var i=0;i<32&&i<bytes.length;i++){bytes[i]^=KEY[i%16]}
            cache[name]=bytes;
            out.push({fileName:name,binary:bytes});
            done();
        };
        xhr.onerror=function(){done()};
        xhr.send(null);
    }
    for(var i=0;i<infos.length;i++){
        var info=infos[i];
        if(!info)continue;
        for(var s=0;s<STYLES.length;s++){
            var idx=info[STYLES[s][0]];
            if(typeof idx!=='number'||idx<0||!files[idx])continue;
            var fileId=(files[idx].Id!==undefined)?files[idx].Id:files[idx];
            if(!fileId)continue;
            var name=info.Name+STYLES[s][1]+'.ttf';
            if(cache[name]){out.push({fileName:name,binary:cache[name]});continue}
            load(base+fileId,name);
        }
    }
    if(pending===0&&cb){cb(out)}
};
w.AscCommon.fetchFonts.__ooFetchFontsPatched=true;
}catch(e){console.error('[oo] fetchFonts shim error',e)}})();
"""

# ---------------------------------------------------------------------------
# compareVersions + 本地许可补丁（word/cell/slide 已注入；visio 补齐）
# ---------------------------------------------------------------------------
LICENSE_SHIM = """;(function(){var w=window;
if(!w.compareVersions){w.compareVersions=true}
try{
var B=w.AscCommon&&w.AscCommon.baseEditorsApi&&w.AscCommon.baseEditorsApi.prototype;
if(B&&!B.__ooOfflineLicensePatched){B.__ooOfflineLicensePatched=true;
var orig=B._onEndPermissions;
B._onEndPermissions=function(){
if(this.isOnLoadLicense&&null===this.licenseResult){
this.licenseResult={type:3,rights:1,branding:false,customization:false,light:false,mode:0,buildVersion:'9.4.0',buildNumber:1};}
return orig.apply(this,arguments)};}
}catch(e){console.error('[oo] offline license shim error',e)}})();
"""


def has_marker(path, marker):
    try:
        with open(path, 'rb') as f:
            return marker.encode() in f.read()
    except OSError:
        return False


BACKUP_DIR = os.path.join(ROOT, '.record', 'backup-sdkall')


def build_empty_shim(product):
    """生成 getEmpty shim（返回 OfflineApp 所需的空文档 SER bin）。
    word：从 sdk-all.js 的 g_sEmpty_bin 提取；cell/slide：x2t 转换 blank 模板的 base64。"""
    if product == 'word':
        p = os.path.join(BACKUP_DIR, 'getEmpty.shim.txt')
        if os.path.exists(p):
            return open(p, encoding='utf-8').read().strip()
        return None
    if product in ('cell', 'slide'):
        b64_path = os.path.join(BACKUP_DIR, f'{product}.empty.b64')
        if not os.path.exists(b64_path):
            return None
        b64 = open(b64_path, encoding='utf-8').read().strip()
        return (';(function(){var w=window;w.AscCommon=w.AscCommon||{};'
                'if(!w.AscCommon.getEmpty){w.AscCommon.getEmpty=function(){var s=atob("'
                + b64 + '");var a=new Uint8Array(s.length);for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i);return a}}})();')
    return None


def inject(path, code):
    # 二进制追加：避免 Windows 文本模式把 \n 再转成 \r\n（会与文件原有 CRLF 叠加成 CRCRLF）
    with open(path, 'ab') as f:
        f.write(code.encode('utf-8'))


def rebuild_compressed(src):
    """重建 .br（brotli q11）与 .gz（gzip -9）。"""
    br = src + '.br'
    gz = src + '.gz'
    brotli = shutil.which('brotli')
    if brotli:
        try:
            subprocess.run([brotli, '-q', '11', '-f', '-o', br, src], check=True)
        except Exception as e:
            print(f'  [warn] brotli 压缩失败: {br} ({e})')
    with open(src, 'rb') as f:
        data = f.read()
    with open(gz, 'wb') as f:
        f.write(gzip.compress(data, compresslevel=9, mtime=0))
    print(f'  rebuilt: {os.path.relpath(br, ROOT)} ({os.path.getsize(br)} B)')
    print(f'  rebuilt: {os.path.relpath(gz, ROOT)} ({os.path.getsize(gz)} B)')


def main():
    parser = argparse.ArgumentParser(description='注入 9.4.0 离线支撑 shim（幂等）')
    parser.add_argument('--product', action='append', choices=PRODUCTS,
                        help='只处理指定产品（可重复），默认全部')
    args = parser.parse_args()
    products = args.product or PRODUCTS

    for product in products:
        target = os.path.join(SDKJS, product, 'sdk-all-min.js')
        if not os.path.exists(target):
            print(f'[skip] 不存在: {target}')
            continue
        print(f'===== {product} =====')
        changed = False

        # getEmpty（OfflineApp 空文档 bin）：word 从 g_sEmpty_bin 提取，cell/slide 用 x2t 生成的空 bin
        if not has_marker(target, 'getEmpty=function'):
            empty_shim = build_empty_shim(product)
            if empty_shim:
                inject(target, '\n' + empty_shim + '\n')
                print('  + getEmpty shim')
                changed = True
            else:
                print('  - getEmpty 无来源，跳过')
        else:
            print('  - getEmpty shim 已存在，跳过')

        if not has_marker(target, '__ooFetchFontsPatched'):
            inject(target, '\n' + FETCH_FONTS_SHIM + '\n')
            print('  + fetchFonts shim')
            changed = True
        else:
            with open(target, 'rb') as f:
                raw = f.read()
            if b'__ooFontCache' not in raw:
                # 旧版 shim（无缓存）：删除文件末尾的旧 fetchFonts IIFE 后重注
                text = raw.decode('utf-8', errors='replace')
                pos = text.rfind('__ooFetchFontsPatched')
                start = text.rfind(';(function(){var w=window;', 0, pos)
                if start > 0 and pos > start:
                    text = text[:start].rstrip() + '\n'
                    with open(target, 'wb') as f:
                        f.write(text.encode('utf-8'))
                    inject(target, '\n' + FETCH_FONTS_SHIM + '\n')
                    print('  ~ fetchFonts shim 更新（带缓存）')
                    changed = True
                else:
                    print('  - fetchFonts shim 定位失败，跳过')
            else:
                print('  - fetchFonts shim 已是最新，跳过')

        if not has_marker(target, '__ooOfflineLicensePatched'):
            inject(target, '\n' + LICENSE_SHIM + '\n')
            print('  + license/compareVersions shim')
            changed = True
        else:
            print('  - license shim 已存在，跳过')

        if changed:
            rebuild_compressed(target)
        else:
            print('  无变更，压缩产物不动')

    print('完成。')


if __name__ == '__main__':
    main()

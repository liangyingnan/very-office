/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */


const helper = function() {
    let $elem;

    const set_enabled = function(enabled) {
        if ( enabled ) {
            if ( !$elem ) {
                if ( ($elem = $('div[aria-live]')).length == 0 ) {
                    const tmpl = '<div aria-live="assertive" class="sr-only" style=""></div>'
                    $elem = $(tmpl).appendTo($('body'));
                }
            }
        } else {
            if ( $elem ) {
                $elem.remove($elem);
                $elem = undefined;
            }
        }
    }

    const set_text_to_speech = function(text) {
        if ( !$elem ){
            set_enabled(true);
        }

        $elem.text('');
        setTimeout(function(e) {
            $elem.text(text);
        }, 0);
    }

    return {
        setEnabled: set_enabled,
        disable: function() { set_enabled(false); },
        speech: set_text_to_speech,
    }
}

!window.Common && (window.Common = {});
!Common.Utils && (Common.Utils = {});

Common.Utils.ScreeenReaderHelper = new helper();
define("common/main/lib/util/ScreenReaderHelper", function(){});

/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 *  ScreenReaderFocus.js
 *
 *  Created on 22.11.2023
 *
 */


if (Common === undefined)
    var Common = {};

if (Common.UI === undefined) {
    Common.UI = {};
}

Common.UI.ScreenReaderFocusManager = new(function() {
    var _needShow = false,
        _focusVisible = false,
        _focusMode = false,
        _currentLevel = 0,
        _lastLevel = 0,
        _currentSection = document,
        _lastSection = document,
        _currentControls = [],
        _currentItemIndex,
        _isLockedKeyEvents = false,
        _unlockKeyEvents = false,
        _isDocReady = false,
        _isEditDiagram = false,
        _isSidePanelMode = false,
        _api,
        _app,
        _appPrefix;

    var _setCurrentSection = function (btn, section) {
        _lastSection = _currentSection;
        if (section) {
            _currentSection = section;
            return;
        }
        if (btn === 'esc') {
            if (_currentLevel === 0) {
                _currentSection = document;
            }
            return;
        }
        if (_isEditDiagram) {
            _currentSection = [$(window.parent.document).find('.advanced-settings-dlg:visible')[0], window.document];
        } else if ($('#file-menu-panel').is(':visible')) {
            _currentSection = $('#file-menu-panel');
        } else {
            _currentSection = _currentLevel === 0 ? document : ((btn && btn.closest('.hint-section')) || document);
        }
    };

    var _lockedKeyEvents = function (isLocked) {
        if (_api && (isLocked || !Common.Utils.ModalWindow.isVisible())) {
            _isLockedKeyEvents = isLocked;
            _api.asc_enableKeyEvents(!isLocked);
        }
    };

    var _showFocus = function () {
        if (_currentControls.length === 0 || (($('#file-menu-panel').is(':visible') || _isEditDiagram) && _currentLevel === 1)) {
            _getControls();
            // console.log(_currentControls);
        }
        if (!_focusVisible) {
            if ($('#file-menu-panel').is(':visible')) {
                _setFocusInActiveFileMenuItem();
            } else {
                _setFocusInActiveTab();
            }
        } else if (_currentLevel !== _lastLevel && (_currentLevel === 0 || _currentLevel === 1 && $('#file-menu-panel').is(':visible'))) {
            var id = $(_lastSection).prop('id');
            if (id === 'toolbar') {
                _setFocusInActiveTab();
            } else if (id === 'left-menu' || id === 'right-menu') {
                _setFocusInActiveCategory(id);
            } else if (id === 'file-menu-panel') {
                _setFocusInActiveFileMenuItem();
            }
        } else if (_currentLevel === 1 && _currentLevel !== _lastLevel && ($(_currentSection).prop('id') === 'left-menu' || $(_currentSection).prop('id') === 'right-menu')) {
            _setFocusInSideMenu($(_currentSection).prop('id') === 'left-menu');
        }
        var currItem = _currentControls[_currentItemIndex];
        // console.log(_currentControls[_currentItemIndex]);
        if (currItem) {
            if ($(currItem).parent().hasClass('ribtab') && !$(currItem).parent().hasClass('active') && $(currItem).data('tab') !== 'file') {
                $(currItem).trigger(jQuery.Event('click', {which: 1}));
            }
            $(_currentControls[_currentItemIndex]).focus();
        }
        if (_currentControls.length > 0) {
            !_isLockedKeyEvents && _lockedKeyEvents(true);
            _focusVisible = true;
        } else {
            _focusVisible = false;
        }
    };

    var _hideFocus = function () {
        _focusVisible = false;
        _focusMode = false;
        _isSidePanelMode = false;
    };

    var _nextItem = function () {
        _lastLevel = _currentLevel;
        _currentItemIndex++;
        if (_currentItemIndex > _currentControls.length - 1) {
            _currentItemIndex = 0;
        }
    };

    var _prevItem = function () {
        _lastLevel = _currentLevel;
        _currentItemIndex--;
        if (_currentItemIndex < 0) {
            _currentItemIndex = _currentControls.length - 1;
        }
    };

    var _nextLevel = function(level) {
        _lastLevel = _currentLevel;
        _currentItemIndex = 0;
        _currentControls.length = 0;
        if (level !== undefined) {
            _currentLevel = level;
        } else {
            _currentLevel++;
        }
    };

    var _prevLevel = function() {
        _lastLevel = _currentLevel;
        _currentControls.length = 0;
        _currentLevel--;
    };

    var _resetToDefault = function() {
        _currentLevel = ($('#file-menu-panel').is(':visible') || _isEditDiagram) ? 1 : 0;
        _setCurrentSection();
        _currentControls.length = 0;
    };

    var _setFocusInActiveTab = function () {
        var activeTab;
        for (var i=0; i<_currentControls.length; i++) {
            var parent = $(_currentControls[i]).parent();
            if (parent && parent.hasClass('ribtab') && parent.hasClass('active')) {
                activeTab = _currentControls[i];
                break;
            }
        }
        if (activeTab) {
            _currentItemIndex = i;
        }
    };

    var _setFocusInActiveCategory = function (id) {
        var activeCategory;
        for (var i=0; i<_currentControls.length; i++) {
            var item = $(_currentControls[i]);
            if ($(item.closest('.hint-section')).prop('id') === id && item.hasClass('btn-category') && item.hasClass('active')) {
                activeCategory = _currentControls[i];
                break;
            }
        }
        if (activeCategory) {
            _currentItemIndex = i;
        }
    };

    var _setFocusInActiveFileMenuItem = function () {
        var activeItem;
        for (var i=0; i<_currentControls.length; i++) {
            if ($(_currentControls[i]).parent().hasClass('active')) {
                activeItem = _currentControls[i];
                break;
            }
        }
        if (activeItem) {
            _currentItemIndex = i;
        }
    };

    var _setFocusInSideMenu = function (isLeftMenu) {
        var index = 0,
            view, btn;
        if (isLeftMenu) {
            view = _app.getController('LeftMenu').getView('LeftMenu');
            btn = view.getFocusElement();
        }
        if (btn) {
            for (var i=0; i<_currentControls.length; i++) {
                if ($(_currentControls[i]).is($(btn))) {
                    index = i;
                    break;
                }
            }
        }
        _currentItemIndex = index;
    };

    var _isItemDisabled = function (item) {
        return (item.hasClass('disabled') || item.parent().hasClass('disabled') || item.attr('disabled'));
    };

    var _getControls = function() {
        _currentControls = [];
        var arr = [];
        if (_.isArray(_currentSection)) {
            _currentSection.forEach(function (section) {
                arr = arr.concat($(section).find('[data-hint=' + (_currentLevel) + ']').toArray());
            });
        } else {
            arr = $(_currentSection).find('[data-hint=' + (_currentLevel) + ']').toArray();
        }
        _currentControls = arr.filter(function (item) {
            return ($(item).is(':visible') && !_isItemDisabled($(item)));
        });
        _currentControls.forEach(function (item) {
            if ($(item).attr("tabindex") === undefined) $(item).attr("tabindex", 0);
        });
    };

    var _exitFocusMode = function () {
        _hideFocus();
        _resetToDefault();
        _isLockedKeyEvents && _lockedKeyEvents(false);
    };

    var _init = function(api) {
        if (Common.Utils.isIE || Common.UI.isMac && Common.Utils.isGecko) // turn off hints on IE and FireFox (shortcut F6 selects link in address bar)
            return;
        _api = api;
        _app = window.DE || window.PE || window.SSE || window.PDFE || window.VE;
        _isDocReady = true;

        var filter = Common.localStorage.getKeysFilter();
        _appPrefix = (filter && filter.length) ? filter.split(',')[0] : '';

        if ( !Common.Utils.ScreeenReaderHelper ) {
            require(['common/main/lib/util/ScreenReaderHelper'], function () {
                Common.Utils.ScreeenReaderHelper.setEnabled(true);
            });
        }

        $('#editor_sdk').on('click', function () {
            _exitFocusMode();
        });
        $(document).on('mousedown', function () {
            _exitFocusMode();
        });
        $(document).on('keyup', function(e) {
            if ((e.keyCode == Common.UI.Keys.ALT || e.keyCode === 91) && _needShow && !(window.SSE && window.SSE.getController('Statusbar').getIsDragDrop())) {
                e.preventDefault();
                if (!_focusVisible) {
                    $('input:focus').blur(); // to change value in inputField
                    _currentLevel = ($('#file-menu-panel').is(':visible') || _isEditDiagram) ? 1 : 0;
                    _setCurrentSection();
                    _showFocus();
                } else {
                    _exitFocusMode();
                }
            } else if (_unlockKeyEvents) {
                _lockedKeyEvents(false);
                _unlockKeyEvents = false;
            } else if (_focusVisible) {
                e.preventDefault();
            }
            _needShow = false;
        });
        $(document).on('keydown.after.bs.dropdown', function(e) {
            if (_focusVisible) {
                var tag = $(_currentControls[_currentItemIndex]).prop('tagName'),
                    isInputFocused = tag === 'INPUT' || tag === 'TEXTAREA',
                    isDirectionEvent = e.keyCode == Common.UI.Keys.TAB || e.keyCode == Common.UI.Keys.LEFT || e.keyCode == Common.UI.Keys.RIGHT ||
                        e.keyCode == Common.UI.Keys.UP || e.keyCode == Common.UI.Keys.DOWN,
                    isControlEvent = e.keyCode == Common.UI.Keys.ESC || e.keyCode == Common.UI.Keys.RETURN || e.keyCode == Common.UI.Keys.SPACE;
                if($(_currentControls[_currentItemIndex]).data('move-focus-only-tab') && e.keyCode !== Common.UI.Keys.TAB && !isControlEvent) return;
                if (!(isDirectionEvent || isControlEvent) || (e.keyCode == Common.UI.Keys.SPACE && isInputFocused)) return;
                if (isDirectionEvent) e.preventDefault(); // allow to write in inputs
                Common.UI.Menu.Manager.hideAll();
                var turnOffHints = false,
                    btn = _currentControls[_currentItemIndex] && $(_currentControls[_currentItemIndex]);
                var isFileMenu = $('#file-menu-panel').is(':visible'),
                    isBtnCategory = btn && btn.hasClass('btn-category'),
                    left = e.keyCode == Common.UI.Keys.LEFT,
                    right = e.keyCode == Common.UI.Keys.RIGHT,
                    up = e.keyCode == Common.UI.Keys.UP,
                    down = e.keyCode == Common.UI.Keys.DOWN,
                    tab = e.keyCode == Common.UI.Keys.TAB,
                    shiftTab = e.shiftKey && e.keyCode == Common.UI.Keys.TAB,
                    isPrevItem,
                    isNextItem,
                    isPrevLevel,
                    isNextLevel;
                if (isFileMenu) {
                    isPrevItem = left || up;
                    isNextItem = _currentLevel === 2 ? (right || down || tab && !shiftTab) : (right || down);
                    isPrevLevel = shiftTab;
                    isNextLevel = tab && !shiftTab;
                } else if (isBtnCategory) {
                    isPrevItem = up || shiftTab;
                    isNextItem = down || tab;
                    isPrevLevel = false;
                    isNextLevel = right || left;
                } else if (_isSidePanelMode) {
                    isPrevItem = shiftTab;
                    isNextItem = tab;
                    isPrevLevel = false;
                    isNextLevel = false;
                } else {
                    isPrevItem = left || shiftTab;
                    isNextItem = right || tab && !shiftTab;
                    isPrevLevel = up;
                    isNextLevel = down;
                }
                if (e.keyCode == Common.UI.Keys.ESC) {
                    _exitFocusMode();
                    return;
                } else if (e.keyCode == Common.UI.Keys.RETURN || e.keyCode == Common.UI.Keys.SPACE) {
                    if (btn) {
                        if (btn.attr('for')) { // to trigger event in checkbox
                            (e.keyCode == Common.UI.Keys.RETURN) ? $('#' + btn.attr('for')).trigger(jQuery.Event('click', {which: 1})) : e.preventDefault(); // prevent type space in document
                        } else {
                            if (btn.data('tab') === 'file' || isFileMenu && _currentLevel === 1 || isBtnCategory)
                                btn.trigger(jQuery.Event('click', {which: 1}));
                            else
                                setTimeout(function() {btn.trigger(jQuery.Event('click', {which: 1}));}, 1); // click on toolbar buttons
                        }
                        if (btn.data('toggle') !== 'dropdown') btn.blur();
                    }
                    if (btn && btn.data('tab') === 'file' || isFileMenu && _currentLevel === 1 || isBtnCategory && btn.hasClass('active')) {
                        (isBtnCategory && btn.hasClass('active')) && (_isSidePanelMode = true);
                        _nextLevel();
                        _setCurrentSection(btn);
                    } else {
                        _hideFocus();
                        _resetToDefault();
                        Common.UI.HintManager.isHintVisible() && Common.UI.HintManager.clearHints(false, true);
                        if (btn && btn.data('toggle') !== 'dropdown') _unlockKeyEvents = true;
                        _isLockedKeyEvents = false;
                        return;
                    }
                } else if (isPrevItem) {
                    turnOffHints = true;
                    _prevItem();
                } else if (isNextItem) {
                    turnOffHints = true;
                    _nextItem();
                } else if (isNextLevel) {
                    if ($('.toolbar.folded').not('.expanded').length > 0) return;
                    var attr = '[data-hint="' + (_currentLevel + 1) + '"]';
                    if ($(_currentSection).find(attr).length === 0 || btn && $(btn.closest('.hint-section')).find(attr).filter(':visible').length === 0) return;
                    turnOffHints = true;
                    _nextLevel();
                    _setCurrentSection(btn);
                    if (isBtnCategory) _isSidePanelMode = true;
                } else if (isPrevLevel) {
                    if (_currentLevel === 0) return;
                    turnOffHints = true;
                    _prevLevel();
                    _setCurrentSection(btn);
                }
                if (!_focusMode && turnOffHints) {
                    _focusMode = true;
                    Common.UI.HintManager.isHintVisible() && Common.UI.HintManager.clearHints(false, true);
                }
                _showFocus();
            }
        });
        $(document).on('keydown', function(e) {
            _needShow = Common.Utils.InternalSettings.get(_appPrefix + "settings-show-alt-hints") &&  e.keyCode == Common.UI.Keys.ALT && !e.shiftKey &&
                        !Common.Utils.ModalWindow.isVisible() && _isDocReady && !(window.PE && $('#pe-preview').is(':visible'));

            // Add outline style for focus elements for test
            if (Common.localStorage.getBool('screen-reader-focus-mode', false)) {
                !$(document.body).hasClass('focus-mode') && $(document.body).addClass('focus-mode');
            } else {
                $(document.body).hasClass('focus-mode') && $(document.body).removeClass('focus-mode');
            }
        });
    };

    var _isFocusMode = function () {
        return !!_focusMode;
    }

    return {
        init: _init,
        isFocusMode: _isFocusMode,
        exitFocusMode: _exitFocusMode
    }
})();
define("common/main/lib/controller/ScreenReaderFocus", function(){});

/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 *  AdvancedSettingsWindow.js
 *
 *  Created on 2/21/14
 *
 */

define('common/main/lib/view/AdvancedSettingsWindow',[], function () { 'use strict';
    Common.Views.AdvancedSettingsWindow = Common.UI.Window.extend(_.extend({
        initialize : function(options) {
            var _options = {};
            _.extend(_options,  {
                height: 'auto',
                header: true,
                cls: 'advanced-settings-dlg',
                toggleGroup: 'advanced-settings-group',
                contentTemplate: '', // use instead 'template' for internal layout
                contentStyle: '',
                items: [],
                buttons: ['ok', 'cancel'],
                separator: true
            }, options);

            this.template = options.template || [
                '<div class="box">',
                    '<% if (items.length>0) { %>',
                    '<div class="menu-panel">',
                    '<% _.each(items, function(item) { %>',
                        '<div id="slot-category-<%= item.panelId %>"></div>',
                    '<% }); %>',
                    '</div>',
                    '<div class="separator"></div>',
                    '<% } %>',
                    '<div class="content-panel" style="<%= contentStyle %>">' + _options.contentTemplate + '</div>',
                '</div>',
                '<% if (separator) { %>',
                '<div class="separator horizontal"></div>',
                '<% } %>'
            ].join('');

            _options.tpl = _.template(this.template)(_options);

            this.handler = _options.handler;
            this.toggleGroup = _options.toggleGroup;
            this.contentWidth = _options.contentWidth;
            this.storageName = _options.storageName;

            Common.UI.Window.prototype.initialize.call(this, _options);
        },

        render: function() {
            Common.UI.Window.prototype.render.call(this);

            var me = this;

            var $window = this.getChild();
            $window.find('.dlg-btn').on('click',         _.bind(this.onDlgBtnClick, this));

            this.on('animate:after', _.bind(this.onAnimateAfter, this));

            this.btnsCategory = [];
            this.options.items.forEach(function(item, index) {
                var btn = new Common.UI.Button({
                    parentEl: $window.find('#slot-category-' + item.panelId),
                    cls: 'btn-category ' + (item.categoryCls || ''),
                    caption: item.panelCaption,
                    iconCls: item.categoryIcon || '',
                    enableToggle: true,
                    toggleGroup: me.toggleGroup,
                    allowDepress: false,
                    contentTarget: item.panelId
                });
                btn.cmpEl.attr('content-target', item.panelId)
                btn.on('click', _.bind(me.onCategoryClick, me, btn, index));
                me.btnsCategory.push(btn);
            });
            let menu_panel = $window.find('.menu-panel');
            this.content_panel = $window.find('.content-panel');
            this.content_panel.width(this.contentWidth);
            $window.width(((menu_panel.length>0) ? menu_panel.outerWidth() : 0) + this.content_panel.outerWidth() + 2);

            if (this.options.contentHeight) {
                $window.find('.body > .box').css('height', this.options.contentHeight);
            } else if (typeof this.options.height === 'number') {
                var bodyEl = $window.find('.body'),
                    hfHeight = parseInt($window.find('.header').css('height')) + parseInt($window.find('.footer').css('height')) + parseInt(bodyEl.css('padding-top')) + parseInt(bodyEl.css('padding-bottom')) +
                               parseInt($window.css('border-bottom-width')) + parseInt($window.css('border-top-width'));
                $window.find('.body > .box').css('height', this.options.height - hfHeight);
            }

            this.content_panels = $window.find('.settings-panel');
            if (this.btnsCategory.length>0)
                this.btnsCategory[0].toggle(true, true);

            var onMainWindowResize = function(){
                $window.width(((menu_panel.length>0) ? menu_panel.outerWidth() : 0) + me.content_panel.outerWidth() + 2);
            };
            $(window).on('resize', onMainWindowResize);
            this.on('close', function() {
                $(window).off('resize', onMainWindowResize);
            });
        },

        setHeight: function(height) {
            Common.UI.Window.prototype.setHeight.call(this, height);

            var $window = this.getChild(),
                bodyEl = $window.find('.body'),
                footerHeight = parseInt($window.find('.footer').css('height')) + parseInt(bodyEl.css('padding-top')) + parseInt(bodyEl.css('padding-bottom'));
            $window.find('.body > .box').css('height', parseInt(bodyEl.css('height')) - footerHeight);
        },

        setInnerHeight: function(height) { // height of box element
            var $window = this.getChild(),
                bodyEl = $window.find('.body'),
                hfHeight = parseInt($window.find('.header').css('height')) + parseInt($window.find('.footer').css('height')) + parseInt(bodyEl.css('padding-top')) + parseInt(bodyEl.css('padding-bottom')) +
                           parseInt($window.css('border-bottom-width')) + parseInt($window.css('border-top-width'));

            (height===undefined) && (height = parseInt($window.find('.body > .box').css('height')));
            Common.UI.Window.prototype.setHeight.call(this, height + hfHeight);
            $window.find('.body > .box').css('height', height);
        },

        fixHeight: function(force) { // check height of the content
            let diff = this.content_panels.filter('.active').height() - this.content_panel.height();
            (force || diff>0) && this.setInnerHeight(parseInt(this.$window.find('.body > .box').css('height')) + diff);
        },

        onDlgBtnClick: function(event) {
            var state = event.currentTarget.attributes['result'].value;
            if ( this.handler && this.handler.call(this, state, (state == 'ok') ? this.getSettings() : undefined) )
                return;
            this.close();
        },

        onCategoryClick: function(btn, index) {
            this.content_panels.filter('.active').removeClass('active');
            $("#" + btn.options.contentTarget).addClass("active");
            this.fixHeight();
        },

        getSettings: function() {
            return;
        },

        onPrimary: function() {
            if ( this.handler && this.handler.call(this, 'ok', this.getSettings()) )
                return false;

            this.close();
            return false;
        },

        setActiveCategory: function(index) {
            if (this.btnsCategory.length<1) return;

            index = (index>=0 && index<this.btnsCategory.length) ? index : 0;
            var btnActive = this.btnsCategory[index];
            if (!btnActive.isVisible() || btnActive.isDisabled()) {
                for (var i = 0; i<this.btnsCategory.length; i++){
                    var btn = this.btnsCategory[i];
                    if (btn.isVisible() && !btn.isDisabled()) {
                        btnActive = btn;
                        index = i;
                        break;
                    }
                }
            }
            btnActive.toggle(true);
            this.onCategoryClick(btnActive, index);
        },

        getActiveCategory: function() {
            var index = -1;
            this.btnsCategory.forEach(function(btn, idx){
                if (btn.pressed) index = idx;
            });
            return index;
        },

        close: function(suppressevent) {
            if (this.storageName)
                Common.localStorage.setItem(this.storageName, this.getActiveCategory());
            Common.UI.Window.prototype.close.call(this, suppressevent);
        },

        onThemeChanged: function() {
            if (!this.$window || !this.isVisible()) return;

            Common.UI.Window.prototype.onThemeChanged.call(this);
            this.fixHeight();
        },

        onAnimateAfter: function() {

        }
    }, Common.Views.AdvancedSettingsWindow || {}));
});
/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 *  DocumentAccessDialog.js
 *
 *  Created on 3/14/14
 *
 */

define('common/main/lib/view/DocumentAccessDialog',[], function () { 'use strict';

    Common.Views.DocumentAccessDialog = Common.UI.Window.extend(_.extend({
        initialize : function(options) {
            var _options = {};
            _.extend(_options,  {
                title: this.textTitle,
                width: 600,
                header: true
            }, options);

            this.template = [
                '<div id="id-sharing-placeholder"></div>'
            ].join('');

            _options.tpl = _.template(this.template)(_options);

            this.settingsurl = options.settingsurl || '';
            Common.UI.Window.prototype.initialize.call(this, _options);
        },

        render: function() {
            Common.UI.Window.prototype.render.call(this);
            this.$window.find('> .body').css({height: 'auto', overflow: 'hidden'});

            var iframe = document.createElement("iframe");
            iframe.width        = '100%';
            iframe.height       = 500;
            iframe.align        = "top";
            iframe.frameBorder  = 0;
            iframe.scrolling    = "no";
            iframe.onload       = _.bind(this._onLoad,this);
            $('#id-sharing-placeholder').append(iframe);

            this.loadMask = new Common.UI.LoadMask({owner: $('#id-sharing-placeholder')});
            this.loadMask.setTitle(this.textLoading);
            this.loadMask.show();

            iframe.src          = this.settingsurl;

            var me = this;
            this._eventfunc = function(msg) {
                me._onWindowMessage(msg);
            };
            this._bindWindowEvents.call(this);

             this.on('close', function(obj){
                me._unbindWindowEvents();
            });
        },

        _bindWindowEvents: function() {
            if (window.addEventListener) {
                window.addEventListener("message", this._eventfunc, false)
            } else if (window.attachEvent) {
                window.attachEvent("onmessage", this._eventfunc);
            }
        },

        _unbindWindowEvents: function() {
            if (window.removeEventListener) {
                window.removeEventListener("message", this._eventfunc)
            } else if (window.detachEvent) {
                window.detachEvent("onmessage", this._eventfunc);
            }
        },

        _onWindowMessage: function(msg) {
            // TODO: check message origin
            if (msg && window.JSON) {
                try {
                    this._onMessage.call(this, window.JSON.parse(msg.data));
                } catch(e) {}
            }
        },

        _onMessage: function(msg) {
            if (msg && msg.Referer == "onlyoffice") {
                if (msg.needUpdate)
                    this.trigger('accessrights', this, msg.sharingSettings);
                Common.NotificationCenter.trigger('window:close', this);
            }
        },

        _onLoad: function() {
            if (this.loadMask)
                this.loadMask.hide();
        },

        textTitle   : 'Sharing Settings',
        textLoading : 'Loading'
    }, Common.Views.DocumentAccessDialog || {}));
});
/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 *  Created on 9/27/18
 */

define('common/main/lib/view/SaveAsDlg',[], function () { 'use strict';

    Common.Views.SaveAsDlg = Common.UI.Window.extend(_.extend({
        initialize : function(options) {
            var _options = {};
            _.extend(_options,  {
                title: this.textTitle,
                width: 420,
                header: true
            }, options);

            this.template = [
                '<div id="id-saveas-folder-placeholder"></div>'
            ].join('');

            _options.tpl = _.template(this.template)(_options);

            this.saveFolderUrl = options.saveFolderUrl || '';
            this.saveFileUrl = options.saveFileUrl || '';
            this.defFileName = options.defFileName || '';
            this.saveFolderUrl = this.saveFolderUrl.replace("{title}", encodeURIComponent(this.defFileName)).replace("{fileuri}", encodeURIComponent(this.saveFileUrl));
            Common.UI.Window.prototype.initialize.call(this, _options);
        },

        render: function() {
            Common.UI.Window.prototype.render.call(this);
            this.$window.find('> .body').css({height: 'auto', overflow: 'hidden'});

            var iframe = document.createElement("iframe");
            iframe.width        = '100%';
            iframe.height       = 645;
            iframe.align        = "top";
            iframe.frameBorder  = 0;
            iframe.scrolling    = "no";
            iframe.onload       = _.bind(this._onLoad,this);
            $('#id-saveas-folder-placeholder').append(iframe);

            this.loadMask = new Common.UI.LoadMask({owner: $('#id-saveas-folder-placeholder')});
            this.loadMask.setTitle(this.textLoading);
            this.loadMask.show();

            iframe.src = this.saveFolderUrl;

            var me = this;
            this._eventfunc = function(msg) {
                me._onWindowMessage(msg);
            };
            this._bindWindowEvents.call(this);

             this.on('close', function(obj){
                me._unbindWindowEvents();
            });
        },

        _bindWindowEvents: function() {
            if (window.addEventListener) {
                window.addEventListener("message", this._eventfunc, false)
            } else if (window.attachEvent) {
                window.attachEvent("onmessage", this._eventfunc);
            }
        },

        _unbindWindowEvents: function() {
            if (window.removeEventListener) {
                window.removeEventListener("message", this._eventfunc)
            } else if (window.detachEvent) {
                window.detachEvent("onmessage", this._eventfunc);
            }
        },

        _onWindowMessage: function(msg) {
            // TODO: check message origin
            if (msg && window.JSON) {
                try {
                    this._onMessage.call(this, window.JSON.parse(msg.data));
                } catch(e) {}
            }
        },

        _onMessage: function(msg) {
            if (msg && msg.Referer == "onlyoffice") {
                if ( !_.isEmpty(msg.error) ) {
                    this.trigger('saveaserror', this, msg.error);
                } else if (!_.isEmpty(msg.message)) {
                    Common.NotificationCenter.trigger('showmessage', {msg: msg.message});
                }
//                if ( !_.isEmpty(msg.folder) ) {
//                    this.trigger('saveasfolder', this, msg.folder); // save last folder url
//                }
                Common.NotificationCenter.trigger('window:close', this);
            }
        },

        _onLoad: function() {
            if (this.loadMask)
                this.loadMask.hide();
        },

        textTitle   : 'Folder for save',
        textLoading : 'Loading'
    }, Common.Views.SaveAsDlg || {}));
});


/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 *  CopyWarningDialog.js
 *
 *  Created on 4/15/14
 *
 */


if (Common === undefined)
    var Common = {};

define('common/main/lib/view/CopyWarningDialog',[], function () { 'use strict';

    Common.Views.CopyWarningDialog = Common.UI.Window.extend(_.extend({
        options: {
            width   : 500,
            cls     : 'modal-dlg copy-warning',
            buttons: ['ok']
        },

        initialize : function(options) {
            _.extend(this.options, {
                title: this.textTitle,
                buttons: ['ok']
            }, options || {});

            const app = (window.DE || window.PE || window.SSE || window.PDFE || window.VE);
            const shortcutsController =  app.getController('Common.Controllers.Shortcuts');

            const keysShortcuts = { Copy: '', Cut: '', Paste: ''};
            for (const actionType in keysShortcuts) {
                const shortcuts = shortcutsController.getShortcutsByActionType(actionType);
                if(shortcuts && shortcuts[0]) {
                    keysShortcuts[actionType] = shortcuts[0].keys.join('+');
                }
            }

            this.template = [
                '<div class="box">',
                    '<p class="message">' + this.textMsg + '</p>',
                    '<div class="hotkeys">',
                        '<div>',
                            '<p class="hotkey">' + keysShortcuts.Copy + '</p>',
                            '<p class="message">' + this.textToCopy + '</p>',
                        '</div>',
                        '<div>',
                        '<p class="hotkey">' + keysShortcuts.Cut + '</p>',
                            '<p class="message">' + this.textToCut + '</p>',
                        '</div>',
                        '<div>',
                            '<p class="hotkey">' + keysShortcuts.Paste + '</p>',
                            '<p class="message">' + this.textToPaste + '</p>',
                        '</div>',
                    '</div>',
                    '<div id="copy-warning-checkbox" class="text-align-left" style="padding: 15px 0;"></div>',
                '</div>',
                '<div class="separator horizontal"></div>'
            ].join('');

            this.options.tpl = _.template(this.template)(this.options);

            Common.UI.Window.prototype.initialize.call(this, this.options);
        },

        render: function() {
            Common.UI.Window.prototype.render.call(this);

            this.chDontShow = new Common.UI.CheckBox({
                el: $('#copy-warning-checkbox'),
                labelText: this.textDontShow
            });

            this.getChild().find('.dlg-btn').on('click', _.bind(this.onBtnClick, this));
        },

        getFocusedComponents: function() {
            return [this.chDontShow].concat(this.getFooterButtons());
        },

        getDefaultFocusableComponent: function () {
            return this.chDontShow;
        },

        onBtnClick: function(event) {
            if (this.options.handler) this.options.handler.call(this, this.chDontShow.getValue() == 'checked');
            this.close();
        },

        onKeyPress: function(event) {
            if (event.keyCode == Common.UI.Keys.RETURN) {
                if (this.options.handler) this.options.handler.call(this, this.chDontShow.getValue() == 'checked');
                this.close();
            }
        },

        getSettings: function() {
            return (this.chDontShow.getValue() == 'checked');
        },

        textTitle   : 'Copy, Cut and Paste Actions',
        textMsg     : 'Copy, cut and paste actions using the editor toolbar buttons and context menu actions will be performed within this editor tab only.<br><br>To copy or paste to or from applications outside the editor tab use the following keyboard combinations:',
        textToCopy  : 'for Copy',
        textToPaste : 'for Paste',
        textToCut: 'for Cut',
        textDontShow: 'Don\'t show this message again'
    }, Common.Views.CopyWarningDialog || {}))
});
/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Date: 09.02.15
 */

define('common/main/lib/view/SelectFileDlg',[], function () { 'use strict';

    Common.Views.SelectFileDlg = Common.UI.Window.extend(_.extend({
        initialize : function(options) {
            var _options = {};
            _.extend(_options,  {
                title: this.textTitle,
                width: 1024,
                header: true
            }, options);

            this.template = [
                '<div id="id-select-file-placeholder"></div>'
            ].join('');

            _options.tpl = _.template(this.template)(_options);

            this.fileChoiceUrl = options.fileChoiceUrl || '';
            Common.UI.Window.prototype.initialize.call(this, _options);
        },

        render: function() {
            Common.UI.Window.prototype.render.call(this);
            this.$window.find('> .body').css({height: 'auto', overflow: 'hidden'});

            var iframe = document.createElement("iframe");
            iframe.width        = '100%';
            iframe.height       = 585;
            iframe.align        = "top";
            iframe.frameBorder  = 0;
            iframe.scrolling    = "no";
            iframe.onload       = _.bind(this._onLoad,this);
            $('#id-select-file-placeholder').append(iframe);

            this.loadMask = new Common.UI.LoadMask({owner: $('#id-select-file-placeholder')});
            this.loadMask.setTitle(this.textLoading);
            this.loadMask.show();

            iframe.src = this.fileChoiceUrl;

            var me = this;
            this._eventfunc = function(msg) {
                me._onWindowMessage(msg);
            };
            this._bindWindowEvents.call(this);

            this.on('close', function(obj){
                me._unbindWindowEvents();
            });
        },

        _bindWindowEvents: function() {
            if (window.addEventListener) {
                window.addEventListener("message", this._eventfunc, false)
            } else if (window.attachEvent) {
                window.attachEvent("onmessage", this._eventfunc);
            }
        },

        _unbindWindowEvents: function() {
            if (window.removeEventListener) {
                window.removeEventListener("message", this._eventfunc)
            } else if (window.detachEvent) {
                window.detachEvent("onmessage", this._eventfunc);
            }
        },

        _onWindowMessage: function(msg) {
            // TODO: check message origin
            if (msg && window.JSON) {
                try {
                    this._onMessage.call(this, window.JSON.parse(msg.data));
                } catch(e) {}
            }
        },

        _onMessage: function(msg) {
            if (msg && msg.Referer == "onlyoffice" && msg.file !== undefined) {
                Common.NotificationCenter.trigger('window:close', this);
                var me = this;
                setTimeout(function() {
                    if ( !_.isEmpty(msg.file) ) {
                        me.trigger('selectfile', me, msg.file);
                    }
                }, 50);
            }
        },

        _onLoad: function() {
            if (this.loadMask)
                this.loadMask.hide();
        },

        textTitle   : 'Select Data Source',
        textLoading : 'Loading'
    }, Common.Views.SelectFileDlg || {}));
});

/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 *  RenameDialog.js
 *
 *  Created on 9/23/16
 *
 */

define('common/main/lib/view/RenameDialog',[], function () { 'use strict';

    Common.Views.RenameDialog = Common.UI.Window.extend(_.extend({
        options: {
            width: 330,
            header: false,
            cls: 'modal-dlg',
            filename: '',
            buttons: ['ok', 'cancel']
        },

        initialize : function(options) {
            _.extend(this.options, options || {});

            this.template = [
                '<div class="box">',
                    '<div class="input-row">',
                        '<label>' + this.textName + '</label>',
                    '</div>',
                    '<div id="id-dlg-newname" class="input-row"></div>',
                '</div>'
            ].join('');

            this.options.tpl = _.template(this.template)(this.options);

            Common.UI.Window.prototype.initialize.call(this, this.options);
        },

        render: function() {
            Common.UI.Window.prototype.render.call(this);

            var me = this;
            me.inputName = new Common.UI.InputField({
                el          : $('#id-dlg-newname'),
                style       : 'width: 100%;',
                validateOnBlur: false,
                maxLength: me.options.maxLength,
                validation  : function(value) {
                    return (/[\t*\+:\"<>?|\\\\/]/gim.test(value)) ? me.txtInvalidName + "*+:\"<>?|\/" : true;
                }
            });

            var $window = this.getChild();
            $window.find('.btn').on('click',     _.bind(this.onBtnClick, this));

            me.inputNameEl = $window.find('input');
        },

        getFocusedComponents: function() {
            return [this.inputName].concat(this.getFooterButtons());
        },

        getDefaultFocusableComponent: function () {
            return this.inputName;
        },

        show: function() {
            Common.UI.Window.prototype.show.apply(this, arguments);

            var me = this;
            var idx = me.options.filename.lastIndexOf('.');
            if (idx>0)
                me.options.filename = me.options.filename.substring(0, idx);
            _.delay(function(){
                me.inputName.setValue(me.options.filename);
                me.inputNameEl.focus().select();
            },100);
        },

        onPrimary: function(event) {
            this._handleInput('ok');
            return false;
        },

        onBtnClick: function(event) {
            this._handleInput(event.currentTarget.attributes['result'].value);
        },

        _handleInput: function(state) {
            if (this.options.handler) {
                if (state == 'ok') {
                    if (this.inputName.checkValidate() !== true)  {
                        this.inputNameEl.focus();
                        return;
                    }
                }

                this.options.handler.call(this, state, this.inputName.getValue());
            }

            this.close();
        },

        textName        : 'File name',
        txtInvalidName  : 'The file name cannot contain any of the following characters: '
    }, Common.Views.RenameDialog || {}));
});
/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Date: 17.05.16
 */

if (Common === undefined)
    var Common = {};

Common.Views = Common.Views || {};

define('common/main/lib/view/PluginDlg',[], function () {
    'use strict';

    Common.Views.PluginDlg = Common.UI.Window.extend(_.extend({
        initialize : function(options) {
            var _options = {};
            _.extend(_options,  {
                header: true,
                enableKeyEvents: false,
                automove: false
            }, options);

            this.bordersOffset = 40;
            _options.width = (Common.Utils.innerWidth()-this.bordersOffset*2-_options.width)<0 ? Common.Utils.innerWidth()-this.bordersOffset*2: _options.width;
            _options.cls += ' advanced-settings-dlg invisible-borders';
            (!_options.buttons || _.size(_options.buttons)<1) && (_options.cls += ' no-footer');
            _options.contentHeight = _options.height;
            _options.height = 'auto';

            this.template = [
                '<div id="id-plugin-container" class="box" style="height:' + _options.contentHeight + 'px;">',
                '<div id="id-plugin-placeholder" style="width: 100%;height: 100%;"></div>',
                '</div>',
                '<% if ((typeof buttons !== "undefined") && _.size(buttons) > 0) { %>',
                '<div class="separator horizontal"></div>',
                '<% } %>'
            ].join('');

            _options.tpl = _.template(this.template)(_options);

            this.url = options.url || '';
            this.loader = (options.loader!==undefined) ? options.loader : true;
            this.frameId = options.frameId || 'plugin_iframe';
            this.guid = options.guid;
            Common.UI.Window.prototype.initialize.call(this, _options);
        },

        render: function() {
            Common.UI.Window.prototype.render.call(this);

            var bodyEl = this.$window.find('> .body');
            bodyEl.css({height: 'auto', overflow: 'hidden'});
            this.boxEl = this.$window.find('.body > .box');

            this._headerFooterHeight = this.options.header ? parseInt(this.$window.find('.header').css('height')) : 0;
            if (this.options.buttons && _.size(this.options.buttons)>0)
                this._headerFooterHeight += parseInt(this.$window.find('.footer').css('height')) + parseInt(bodyEl.css('padding-top')) + parseInt(bodyEl.css('padding-bottom'));
            this._headerFooterHeight += ((parseInt(this.$window.css('border-top-width')) + parseInt(this.$window.css('border-bottom-width'))));

            if (Common.Utils.innerHeight()-this.bordersOffset*2 < this.options.contentHeight + this._headerFooterHeight) {
                this._restoreHeight = this.options.contentHeight + this._headerFooterHeight;
                this.options.contentHeight = Common.Utils.innerHeight()-this.bordersOffset*2 - this._headerFooterHeight;
                this.boxEl.css('height', this.options.contentHeight);
            }

            this.$window.find('.header').prepend($('<div class="tools left hidden"></div>'));

            var iframe = document.createElement("iframe");
            iframe.id           = this.frameId;
            iframe.name         = 'pluginFrameEditor';
            iframe.width        = '100%';
            iframe.height       = '100%';
            iframe.align        = "top";
            iframe.frameBorder  = 0;
            iframe.scrolling    = "no";
            iframe.allow = "camera; microphone; display-capture";
            iframe.onload       = _.bind(this._onLoad,this);

            var me = this;
            var pholder = this.$window.find('#id-plugin-placeholder');
            if (this.loader) {
                setTimeout(function(){
                    if (me.isLoaded) return;
                    me.loadMask = new Common.UI.LoadMask({owner: pholder});
                    me.loadMask.setTitle(me.textLoading);
                    me.loadMask.show();
                    if (me.isLoaded) me.loadMask.hide();
                }, 500);
            }

            iframe.src = this.url;
            pholder.append(iframe);
            this.frame = iframe;
            this.on('resizing', function(args){
                me.boxEl.css('height', parseInt(me.$window.css('height')) - me._headerFooterHeight);
            });

            var onMainWindowResize = function(){
                me.onWindowResize();
            };
            $(window).on('resize', onMainWindowResize);
            this.on('close', function() {
                $(window).off('resize', onMainWindowResize);
            });

            if(this.options.isCanDocked) {
                this.showDockedButton();
            }
        },

        _onLoad: function() {
            this.isLoaded = true;
            if (this.loadMask)
                this.loadMask.hide();
        },

        setInnerSize: function(width, height) {
            var maxHeight = Common.Utils.innerHeight(),
                maxWidth = Common.Utils.innerWidth(),
                borders_width = (parseInt(this.$window.css('border-left-width')) + parseInt(this.$window.css('border-right-width'))),
                bordersOffset = this.bordersOffset*2;
            if (maxHeight - bordersOffset<height + this._headerFooterHeight)
                height = maxHeight - bordersOffset - this._headerFooterHeight;
            if (maxWidth - bordersOffset<width + borders_width)
                width = maxWidth - bordersOffset - borders_width;

            this.boxEl.css('height', height);

            Common.UI.Window.prototype.setHeight.call(this, height + this._headerFooterHeight);
            Common.UI.Window.prototype.setWidth.call(this, width + borders_width);

            if (this.getLeft() + width + borders_width > maxWidth)
                this.$window.css('left', Math.max(0, maxWidth - width - borders_width - this.bordersOffset));
            if (this.getTop() + height + this._headerFooterHeight > maxHeight)
                this.$window.css('top', Math.max(0, maxHeight - height - this._headerFooterHeight - this.bordersOffset));

            this._restoreHeight = this._restoreWidth = undefined;
        },

        onWindowResize: function() {
            var main_width  = Common.Utils.innerWidth(),
                main_height = Common.Utils.innerHeight(),
                win_width = this.getWidth(),
                win_height = this.getHeight(),
                bordersOffset = (this.resizable) ? 0 : this.bordersOffset;
            if (win_height<main_height-bordersOffset*2+0.1 ) {
                if (!this.resizable && this._restoreHeight>0 && win_height < this._restoreHeight) {
                    var height = Math.max(Math.min(this._restoreHeight, main_height-bordersOffset*2), this.initConfig.minheight);
                    this.setHeight(height);
                    this.boxEl.css('height', height - this._headerFooterHeight);
                }
                var top = this.getTop();
                if (top<bordersOffset) this.$window.css('top', bordersOffset);
                else if (top+win_height>main_height-bordersOffset)
                    this.$window.css('top', main_height-bordersOffset - win_height);
            } else {
                if (this._restoreHeight===undefined) {
                    this._restoreHeight = win_height;
                }
                this.setHeight(Math.max(main_height-bordersOffset*2, this.initConfig.minheight));
                this.boxEl.css('height', Math.max(main_height-bordersOffset*2, this.initConfig.minheight) - this._headerFooterHeight);
                this.$window.css('top', bordersOffset);
            }
            if (win_width<main_width-bordersOffset*2+0.1) {
                if (!this.resizable && this._restoreWidth>0 && win_width < this._restoreWidth) {
                    this.setWidth(Math.max(Math.min(this._restoreWidth, main_width-bordersOffset*2), this.initConfig.minwidth));
                }
                var left = this.getLeft();
                if (left<bordersOffset) this.$window.css('left', bordersOffset);
                else if (left+win_width>main_width-bordersOffset)
                    this.$window.css('left', main_width-bordersOffset-win_width);
            } else {
                if (this._restoreWidth===undefined) {
                    this._restoreWidth = win_width;
                }
                this.setWidth(Math.max(main_width-bordersOffset*2, this.initConfig.minwidth));
                this.$window.css('left', bordersOffset);
            }
        },

        showDockedButton: function() {
            var header = this.$window.find('.header .tools:not(.left)'),
                // header = this.$window.find('.header .tools.left'),
                btnId = 'id-plugindlg-docked',
                btn = header.find('#' + btnId);
            if (btn.length < 1) {
                var iconCls = 'btn-pin';
                btn = $('<div id="' + btnId + '" class="tool custom toolbar__icon ' + iconCls + '"></div>');
                btn.on('click', _.bind(function() {
                    var tip = btn.data('bs.tooltip');
                    if (tip) tip.dontShow = true;
                    this.fireEvent('docked', this.frameId);
                }, this));
                header.append(btn);
                btn.tooltip({title: this.textDock, placement: 'cursor', zIndex: parseInt(this.$window.css('z-index')) + 10});
            }
            btn.show();
            header.removeClass('hidden');
        },

        showButton: function(id, toRight) {
            var header = this.$window.find(toRight ? '.header .tools:not(.left)' : '.header .tools.left'),
                btn = header.find('#id-plugindlg-' + id);
            if (btn.length<1) {
                var iconCls = (id ==='back') ? 'btn-promote' : 'btn-' + Common.Utils.String.htmlEncode(id);
                btn = $('<div id="id-plugindlg-' + id + '" class="tool custom toolbar__icon ' + iconCls + '"></div>');
                btn.on('click', _.bind(function() {
                    this.fireEvent('header:click',id);
                }, this));
                header.append(btn);
            }
            btn.show();
            header.removeClass('hidden');
        },

        hideButton: function(id) {
            var btn = this.$window.find('.header #id-plugindlg-' + id);
            if (btn.length>0) {
                btn.hide();
            }
        },

        enablePointerEvents: function(enable) {
            this.frame && (this.frame.style.pointerEvents = enable ? "" : "none");
        },

        textLoading : 'Loading',
        textDock: 'Pin plugin'
    }, Common.Views.PluginDlg || {}));
});
/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Date: 22.07.23
 */

if (Common === undefined)
    var Common = {};

Common.Views = Common.Views || {};

define('common/main/lib/view/PluginPanel',[], function () {
    'use strict';

    Common.Views.PluginPanel = Common.UI.BaseView.extend(_.extend({
        template: _.template([
            '<div class="current-plugin-box layout-ct vbox">',
                '<div class="current-plugin-frame">',
                '</div>',
                '<div class="current-plugin-header">',
                    '<div class="tools">',
                        '<div class="plugin-close close"></div>',
                        '<div class="plugin-hide"></div>',
                    '</div>',
                    '<label></label>',
                '</div>',
            '</div>',
            '<div id="plugins-mask" style="display: none;">'
        ].join('')),

        initialize: function(options) {
            _.extend(this, options);
            this._state = {};
            if (!this.menu) {
                this.menu = 'left';
            }
            Common.UI.BaseView.prototype.initialize.call(this, arguments);
        },

        render: function(el) {
            el && (this.$el = $(el));
            this.$el.html(this.template({scope: this}));

            this.pluginName = $('.current-plugin-header label', this.$el);
            this.pluginsMask = $('#plugins-mask', this.$el);
            this.currentPluginPanel = $('.current-plugin-box', this.$el);
            this.currentPluginFrame = $('.current-plugin-frame', this.$el);

            this.pluginClose = new Common.UI.Button({
                parentEl: this.$el.find('.plugin-close'),
                cls: 'btn-toolbar',
                iconCls: 'toolbar__icon btn-close',
                hint: this.textClosePanel
            });

            var xpadding = 1;
            if (this.sideMenuButton) {
                this.pluginHide = new Common.UI.Button({
                    parentEl: this.$el.find('.plugin-hide'),
                    cls: 'btn-toolbar' + (this.menu==='right' ^ Common.UI.isRTL() ? ' icon-mirrored' : ''),
                    iconCls: 'toolbar__icon btn-panel-left-collapse',
                    hint: this.textHidePanel
                });
                xpadding++;
            }

            if(this.isCanDocked) {
                this.showDockedButton();
                xpadding++;
            }
            this.pluginName.css(Common.UI.isRTL() ? 'padding-left' : 'padding-right', (parseInt(Common.UI.Themes.getThemeProps('small-btn-size')) * xpadding + 5) + 'px');

            this.trigger('render:after', this);
            return this;
        },

        showDockedButton: function() {
            var header = this.$el.find('.current-plugin-header .tools'),
                btnCls = 'plugin-undock',
                btn = header.find('.' + btnCls);
            if (btn.length < 1) {
                btn = $('<div class="' + btnCls + '"></div>');
                this.$el.find('.plugin-close').after(btn);
                var btnUndock = new Common.UI.Button({
                    parentEl: this.$el.find('.' + btnCls),
                    cls: 'btn-toolbar',
                    iconCls: 'toolbar__icon btn-unpin',
                    hint: this.textUndock
                });
                btnUndock.on('click', _.bind(function() {
                    this.fireEvent('docked', this.iframePlugin.id);
                }, this));
            }
            btn.show();
            header.removeClass('hidden');
        },

        openInsideMode: function(name, url, frameId, guid) {
            if (!this.pluginName) this.render();

            this.pluginName.text(name);
            if (!this.iframePlugin) {
                this.iframePlugin = document.createElement("iframe");
                this.iframePlugin.id           = (frameId === undefined) ? 'plugin_iframe' : frameId;
                this.iframePlugin.name         = 'pluginFrameEditor';
                this.iframePlugin.width        = '100%';
                this.iframePlugin.height       = '100%';
                this.iframePlugin.align        = "top";
                this.iframePlugin.frameBorder  = 0;
                this.iframePlugin.scrolling    = "no";
                this.iframePlugin.allow = "camera; microphone; display-capture";
                this.iframePlugin.onload       = _.bind(this._onLoad,this);
                this.currentPluginFrame.append(this.iframePlugin);

                if (!this.loadMask)
                    this.loadMask = new Common.UI.LoadMask({owner: this.currentPluginFrame});
                this.loadMask.setTitle(this.textLoading);
                this.loadMask.show();

                this.iframePlugin.src = url;
            }
            this._state.insidePlugin = guid;
            return true;
        },

        closeInsideMode: function() {
            if (this.iframePlugin) {
                this.currentPluginFrame.empty();
                this.iframePlugin = null;
            }
            this._state.insidePlugin = undefined;
        },

        _onLoad: function() {
            if (this.loadMask)
                this.loadMask.hide();
        },

        hide: function () {
            Common.UI.BaseView.prototype.hide.call(this,arguments);
        },

        enablePointerEvents: function(enable) {
            this.iframePlugin && (this.iframePlugin.style.pointerEvents = enable ? "" : "none");
        },

        textClosePanel: 'Close plugin',
        textLoading: 'Loading',
        textUndock: 'Unpin plugin',
        textHidePanel: 'Collapse plugin',

    }, Common.Views.PluginPanel || {}));
});
/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 *  TextInputDialog.js
 *
 *  Created on 17/08/24
 *
 */

define('common/main/lib/view/TextInputDialog',[], function () { 'use strict';

    Common.Views.TextInputDialog = Common.UI.Window.extend(_.extend({

        initialize : function(options) {
            var _options = {};

            _.extend(_options, {
                header: !!options.title,
                label: options.label || '',
                description: options.description || '',
                width: 330 || options.width,
                cls: 'modal-dlg',
                buttons: ['ok', 'cancel']
            }, options || {});

            this.template = [
                '<div class="box">',
                    '<div class="input-row <% if (!label) { %> hidden <% } %>">',
                        '<label><%= label %></label>',
                    '</div>',
                    '<div id="id-dlg-label-custom-input" class="input-row"></div>',
                    '<div class="input-row <% if (!description) { %> hidden <% } %>">',
                        '<label class="light"><%= description %></label>',
                    '</div>',
                '</div>'
            ].join('');

            this.inputConfig = _.extend({
                allowBlank: true
            }, options.inputConfig || {});

            this.inputFixedConfig = options.inputFixedConfig;

            _options.tpl = _.template(this.template)(_options);
            Common.UI.Window.prototype.initialize.call(this, _options);
        },

        render: function() {
            Common.UI.Window.prototype.render.call(this);

            var me = this;
            me.inputLabel = !this.inputFixedConfig ? new Common.UI.InputField({
                el          : $('#id-dlg-label-custom-input'),
                allowBlank  : me.inputConfig.allowBlank,
                blankError  : me.inputConfig.blankError,
                maxLength   : me.inputConfig.maxLength,
                style       : 'width: 100%;',
                validateOnBlur: false,
                validation  : me.inputConfig.validation
            }) : new Common.UI.InputFieldFixed({
                el          : $('#id-dlg-label-custom-input'),
                allowBlank  : me.inputConfig.allowBlank,
                blankError  : me.inputConfig.blankError,
                maxLength   : me.inputFixedConfig.fixedValue && me.inputConfig.maxLength ? me.inputConfig.maxLength - me.inputFixedConfig.fixedValue.length : me.inputConfig.maxLength,
                style       : 'width: 100%;',
                validateOnBlur: false,
                validation  : me.inputConfig.validation,
                cls         : 'text-align-left',
                fixedValue  : me.inputFixedConfig.fixedValue,
                fixedCls    : 'light',
                fixedWidth  : me.inputFixedConfig.fixedWidth
            });
            me.inputLabel.cmpEl.on('focus', 'input.fixed-text', function() {
                setTimeout(function(){me.inputLabel._input && me.inputLabel._input.focus();}, 1);
            });
            me.inputLabel.setValue(me.options.value || '');
            var $window = this.getChild();
            $window.find('.dlg-btn').on('click',     _.bind(this.onBtnClick, this));
        },

        getFocusedComponents: function() {
            return [{cmp: this.inputLabel, selector: 'input:not(.fixed-text)'}].concat(this.getFooterButtons());
        },

        getDefaultFocusableComponent: function () {
            return this.inputLabel;
        },

        show: function() {
            Common.UI.Window.prototype.show.apply(this, arguments);

            var me = this;
            _.delay(function(){
                me.getChild('input').focus();
            },50);
        },

        onPrimary: function(event) {
            this._handleInput('ok');
            return false;
        },

        onBtnClick: function(event) {
            this._handleInput(event.currentTarget.attributes['result'].value);
        },

        _handleInput: function(state) {
            if (this.options.handler) {
                if (state == 'ok') {
                    if (this.inputLabel.checkValidate() !== true)  {
                        this.inputLabel.cmpEl.find('input').focus();
                        return;
                    }
                }

                this.options.handler.call(this, state, this.inputLabel.getValue());
            }

            this.close();
        }

    }, Common.Views.TextInputDialog || {}));

    Common.Views.ImageFromUrlDialog = Common.Views.TextInputDialog.extend(_.extend({

        initialize : function(options) {

            var _options = {},
                me = this;
            _.extend(_options, {
                header: false,
                label: options.label || me.textUrl,
                inputConfig: {
                    allowBlank  : false,
                    blankError  : me.txtEmpty,
                    validation  : function(value) {
                        return (/((^https?)|(^ftp)):\/\/.+/i.test(value)) ? true : me.txtNotUrl;
                    }
                }
            }, options || {});

            Common.Views.TextInputDialog.prototype.initialize.call(this, _options);
        },

        textUrl         : 'Paste an image URL:',
        txtEmpty        : 'This field is required',
        txtNotUrl       : 'This field should be a URL in the format \"http://www.example.com\"'
    }, Common.Views.ImageFromUrlDialog || {}));
});
/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

define('common/main/lib/view/DocumentHolderExt',[], function () {
    'use strict';

    let _editor = window.DE || window.PDFE ||window.PDFE || window.PE || window.SSE || window.VE;
    if (_editor && _editor.Views && _editor.Views.DocumentHolder) {
        let dh = _editor.Views.DocumentHolder.prototype;

        dh.addEquationMenu = function(equationMenu, insertIdx) {
            if (!equationMenu) return;

            var me = this;
            me.clearEquationMenu(equationMenu, insertIdx);

            var menuItems = me.initEquationMenu();
            if (menuItems.length > 0) {
                _.each(menuItems, function(menuItem, index) {
                    if (menuItem.menu) {
                        _.each(menuItem.menu.items, function(item) {
                            item.on('click', _.bind(me.equationCallback, me, item.options.equationProps));
                        });
                    } else
                        menuItem.on('click', _.bind(me.equationCallback, me, menuItem.options.equationProps));
                    equationMenu.insertItem(insertIdx, menuItem);
                    insertIdx++;
                });
            }
            return menuItems.length;
        };

        dh.clearEquationMenu = function(equationMenu, insertIdx) {
            for (var i = insertIdx; i < equationMenu.items.length; i++) {
                if (equationMenu.items[i].options.equation) {
                    if (equationMenu.items[i].menu) {
                        _.each(equationMenu.items[i].menu.items, function(item) {
                            item.off('click');
                        });
                    } else
                        equationMenu.items[i].off('click');
                    equationMenu.removeItem(equationMenu.items[i]);
                    i--;
                } else
                    break;
            }
        };

        dh.equationCallback = function(eqProps) {
            var eqObj;
            if (eqProps) {
                switch (eqProps.type) {
                    case Asc.c_oAscMathInterfaceType.Accent:
                        eqObj = new CMathMenuAccent();
                        break;
                    case Asc.c_oAscMathInterfaceType.BorderBox:
                        eqObj = new CMathMenuBorderBox();
                        break;
                    case Asc.c_oAscMathInterfaceType.Box:
                        eqObj = new CMathMenuBox();
                        break;
                    case Asc.c_oAscMathInterfaceType.Bar:
                        eqObj = new CMathMenuBar();
                        break;
                    case Asc.c_oAscMathInterfaceType.Script:
                        eqObj = new CMathMenuScript();
                        break;
                    case Asc.c_oAscMathInterfaceType.Fraction:
                        eqObj = new CMathMenuFraction();
                        break;
                    case Asc.c_oAscMathInterfaceType.Limit:
                        eqObj = new CMathMenuLimit();
                        break;
                    case Asc.c_oAscMathInterfaceType.Matrix:
                        eqObj = new CMathMenuMatrix();
                        break;
                    case Asc.c_oAscMathInterfaceType.EqArray:
                        eqObj = new CMathMenuEqArray();
                        break;
                    case Asc.c_oAscMathInterfaceType.LargeOperator:
                        eqObj = new CMathMenuNary();
                        break;
                    case Asc.c_oAscMathInterfaceType.Delimiter:
                        eqObj = new CMathMenuDelimiter();
                        break;
                    case Asc.c_oAscMathInterfaceType.GroupChar:
                        eqObj = new CMathMenuGroupCharacter();
                        break;
                    case Asc.c_oAscMathInterfaceType.Radical:
                        eqObj = new CMathMenuRadical();
                        break;
                    case Asc.c_oAscMathInterfaceType.Common:
                        eqObj = new CMathMenuBase();
                        break;
                }
                eqObj && eqObj[eqProps.callback](eqProps.value);
            }
            this.fireEvent('equation:callback', [eqObj]);
        };

        dh.initEquationMenu = function() {
            var me = this._currentTranslateObj; // in sse - controller, in other - view
            if (!me._currentMathObj) return;
            var type = me._currentMathObj.get_Type(),
                value = me._currentMathObj,
                mnu, arr = [];

            switch (type) {
                case Asc.c_oAscMathInterfaceType.Accent:
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtRemoveAccentChar,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'remove_AccentCharacter'}
                    });
                    arr.push(mnu);
                    break;
                case Asc.c_oAscMathInterfaceType.BorderBox:
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtBorderProps,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        menu        : new Common.UI.Menu({
                            cls: 'shifted-right',
                            menuAlign: 'tl-tr',
                            items   : [
                                {
                                    caption: value.get_HideTop() ? me.txtAddTop : me.txtHideTop,
                                    equationProps: {type: type, callback: 'put_HideTop', value: !value.get_HideTop()}
                                },
                                {
                                    caption: value.get_HideBottom() ? me.txtAddBottom : me.txtHideBottom,
                                    equationProps: {type: type, callback: 'put_HideBottom', value: !value.get_HideBottom()}
                                },
                                {
                                    caption: value.get_HideLeft() ? me.txtAddLeft : me.txtHideLeft,
                                    equationProps: {type: type, callback: 'put_HideLeft', value: !value.get_HideLeft()}
                                },
                                {
                                    caption: value.get_HideRight() ? me.txtAddRight : me.txtHideRight,
                                    equationProps: {type: type, callback: 'put_HideRight', value: !value.get_HideRight()}
                                },
                                {
                                    caption: value.get_HideHor() ? me.txtAddHor : me.txtHideHor,
                                    equationProps: {type: type, callback: 'put_HideHor', value: !value.get_HideHor()}
                                },
                                {
                                    caption: value.get_HideVer() ? me.txtAddVer : me.txtHideVer,
                                    equationProps: {type: type, callback: 'put_HideVer', value: !value.get_HideVer()}
                                },
                                {
                                    caption: value.get_HideTopLTR() ? me.txtAddLT : me.txtHideLT,
                                    equationProps: {type: type, callback: 'put_HideTopLTR', value: !value.get_HideTopLTR()}
                                },
                                {
                                    caption: value.get_HideTopRTL() ? me.txtAddLB : me.txtHideLB,
                                    equationProps: {type: type, callback: 'put_HideTopRTL', value: !value.get_HideTopRTL()}
                                }
                            ]
                        })
                    });
                    arr.push(mnu);
                    break;
                case Asc.c_oAscMathInterfaceType.Bar:
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtRemoveBar,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'remove_Bar'}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : (value.get_Pos()==Asc.c_oAscMathInterfaceBarPos.Top) ? me.txtUnderbar : me.txtOverbar,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'put_Pos', value: (value.get_Pos()==Asc.c_oAscMathInterfaceBarPos.Top) ? Asc.c_oAscMathInterfaceBarPos.Bottom : Asc.c_oAscMathInterfaceBarPos.Top}
                    });
                    arr.push(mnu);
                    break;
                case Asc.c_oAscMathInterfaceType.Script:
                    var scripttype = value.get_ScriptType();
                    if (scripttype == Asc.c_oAscMathInterfaceScript.PreSubSup) {
                        mnu = new Common.UI.MenuItem({
                            caption     : me.txtScriptsAfter,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_ScriptType', value: Asc.c_oAscMathInterfaceScript.SubSup}
                        });
                        arr.push(mnu);
                        mnu = new Common.UI.MenuItem({
                            caption     : me.txtRemScripts,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_ScriptType', value: Asc.c_oAscMathInterfaceScript.None}
                        });
                        arr.push(mnu);
                    } else {
                        if (scripttype == Asc.c_oAscMathInterfaceScript.SubSup) {
                            mnu = new Common.UI.MenuItem({
                                caption     : me.txtScriptsBefore,
                                equation    : true,
                                disabled    : me._currentParaObjDisabled,
                                equationProps: {type: type, callback: 'put_ScriptType', value: Asc.c_oAscMathInterfaceScript.PreSubSup}
                            });
                            arr.push(mnu);
                        }
                        if (scripttype == Asc.c_oAscMathInterfaceScript.SubSup || scripttype == Asc.c_oAscMathInterfaceScript.Sub ) {
                            mnu = new Common.UI.MenuItem({
                                caption     : me.txtRemSubscript,
                                equation    : true,
                                disabled    : me._currentParaObjDisabled,
                                equationProps: {type: type, callback: 'put_ScriptType', value: (scripttype == Asc.c_oAscMathInterfaceScript.SubSup) ? Asc.c_oAscMathInterfaceScript.Sup : Asc.c_oAscMathInterfaceScript.None }
                            });
                            arr.push(mnu);
                        }
                        if (scripttype == Asc.c_oAscMathInterfaceScript.SubSup || scripttype == Asc.c_oAscMathInterfaceScript.Sup ) {
                            mnu = new Common.UI.MenuItem({
                                caption     : me.txtRemSuperscript,
                                equation    : true,
                                disabled    : me._currentParaObjDisabled,
                                equationProps: {type: type, callback: 'put_ScriptType', value: (scripttype == Asc.c_oAscMathInterfaceScript.SubSup) ? Asc.c_oAscMathInterfaceScript.Sub : Asc.c_oAscMathInterfaceScript.None }
                            });
                            arr.push(mnu);
                        }
                    }
                    break;
                case Asc.c_oAscMathInterfaceType.Fraction:
                    var fraction = value.get_FractionType();
                    if (fraction==Asc.c_oAscMathInterfaceFraction.Skewed || fraction==Asc.c_oAscMathInterfaceFraction.Linear) {
                        mnu = new Common.UI.MenuItem({
                            caption     : me.txtFractionStacked,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_FractionType', value: Asc.c_oAscMathInterfaceFraction.Bar}
                        });
                        arr.push(mnu);
                    }
                    if (fraction==Asc.c_oAscMathInterfaceFraction.Bar || fraction==Asc.c_oAscMathInterfaceFraction.Linear) {
                        mnu = new Common.UI.MenuItem({
                            caption     : me.txtFractionSkewed,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_FractionType', value: Asc.c_oAscMathInterfaceFraction.Skewed}
                        });
                        arr.push(mnu);
                    }
                    if (fraction==Asc.c_oAscMathInterfaceFraction.Bar || fraction==Asc.c_oAscMathInterfaceFraction.Skewed) {
                        mnu = new Common.UI.MenuItem({
                            caption     : me.txtFractionLinear,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_FractionType', value: Asc.c_oAscMathInterfaceFraction.Linear}
                        });
                        arr.push(mnu);
                    }
                    if (fraction==Asc.c_oAscMathInterfaceFraction.Bar || fraction==Asc.c_oAscMathInterfaceFraction.NoBar) {
                        mnu = new Common.UI.MenuItem({
                            caption     : (fraction==Asc.c_oAscMathInterfaceFraction.Bar) ? me.txtRemFractionBar : me.txtAddFractionBar,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_FractionType', value: (fraction==Asc.c_oAscMathInterfaceFraction.Bar) ? Asc.c_oAscMathInterfaceFraction.NoBar : Asc.c_oAscMathInterfaceFraction.Bar}
                        });
                        arr.push(mnu);
                    }
                    break;
                case Asc.c_oAscMathInterfaceType.Limit:
                    mnu = new Common.UI.MenuItem({
                        caption     : (value.get_Pos()==Asc.c_oAscMathInterfaceLimitPos.Top) ? me.txtLimitUnder : me.txtLimitOver,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'put_Pos', value: (value.get_Pos()==Asc.c_oAscMathInterfaceLimitPos.Top) ? Asc.c_oAscMathInterfaceLimitPos.Bottom : Asc.c_oAscMathInterfaceLimitPos.Top}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtRemLimit,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'put_Pos', value: Asc.c_oAscMathInterfaceLimitPos.None}
                    });
                    arr.push(mnu);
                    break;
                case Asc.c_oAscMathInterfaceType.Matrix:
                    mnu = new Common.UI.MenuItem({
                        caption     : value.get_HidePlaceholder() ? me.txtShowPlaceholder : me.txtHidePlaceholder,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'put_HidePlaceholder', value: !value.get_HidePlaceholder()}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.insertText,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        menu        : new Common.UI.Menu({
                            cls: 'shifted-right',
                            menuAlign: 'tl-tr',
                            items   : [
                                {
                                    caption: me.insertRowAboveText,
                                    equationProps: {type: type, callback: 'insert_MatrixRow', value: true}
                                },
                                {
                                    caption: me.insertRowBelowText,
                                    equationProps: {type: type, callback: 'insert_MatrixRow', value: false}
                                },
                                {
                                    caption: me.insertColumnLeftText,
                                    equationProps: {type: type, callback: 'insert_MatrixColumn', value: true}
                                },
                                {
                                    caption: me.insertColumnRightText,
                                    equationProps: {type: type, callback: 'insert_MatrixColumn', value: false}
                                }
                            ]
                        })
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.deleteText,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        menu        : new Common.UI.Menu({
                            cls: 'shifted-right',
                            menuAlign: 'tl-tr',
                            items   : [
                                {
                                    caption: me.deleteRowText,
                                    equationProps: {type: type, callback: 'delete_MatrixRow'}
                                },
                                {
                                    caption: me.deleteColumnText,
                                    equationProps: {type: type, callback: 'delete_MatrixColumn'}
                                }
                            ]
                        })
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtMatrixAlign,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        menu        : new Common.UI.Menu({
                            cls: 'shifted-right',
                            menuAlign: 'tl-tr',
                            items   : [
                                {
                                    caption: me.txtTop,
                                    checkable   : true,
                                    checked     : (value.get_MatrixAlign()==Asc.c_oAscMathInterfaceMatrixMatrixAlign.Top),
                                    equationProps: {type: type, callback: 'put_MatrixAlign', value: Asc.c_oAscMathInterfaceMatrixMatrixAlign.Top}
                                },
                                {
                                    caption: me.centerText,
                                    checkable   : true,
                                    checked     : (value.get_MatrixAlign()==Asc.c_oAscMathInterfaceMatrixMatrixAlign.Center),
                                    equationProps: {type: type, callback: 'put_MatrixAlign', value: Asc.c_oAscMathInterfaceMatrixMatrixAlign.Center}
                                },
                                {
                                    caption: me.txtBottom,
                                    checkable   : true,
                                    checked     : (value.get_MatrixAlign()==Asc.c_oAscMathInterfaceMatrixMatrixAlign.Bottom),
                                    equationProps: {type: type, callback: 'put_MatrixAlign', value: Asc.c_oAscMathInterfaceMatrixMatrixAlign.Bottom}
                                }
                            ]
                        })
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtColumnAlign,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        menu        : new Common.UI.Menu({
                            cls: 'shifted-right',
                            menuAlign: 'tl-tr',
                            items   : [
                                {
                                    caption: me.leftText,
                                    checkable   : true,
                                    checked     : (value.get_ColumnAlign()==Asc.c_oAscMathInterfaceMatrixColumnAlign.Left),
                                    equationProps: {type: type, callback: 'put_ColumnAlign', value: Asc.c_oAscMathInterfaceMatrixColumnAlign.Left}
                                },
                                {
                                    caption: me.centerText,
                                    checkable   : true,
                                    checked     : (value.get_ColumnAlign()==Asc.c_oAscMathInterfaceMatrixColumnAlign.Center),
                                    equationProps: {type: type, callback: 'put_ColumnAlign', value: Asc.c_oAscMathInterfaceMatrixColumnAlign.Center}
                                },
                                {
                                    caption: me.rightText,
                                    checkable   : true,
                                    checked     : (value.get_ColumnAlign()==Asc.c_oAscMathInterfaceMatrixColumnAlign.Right),
                                    equationProps: {type: type, callback: 'put_ColumnAlign', value: Asc.c_oAscMathInterfaceMatrixColumnAlign.Right}
                                }
                            ]
                        })
                    });
                    arr.push(mnu);
                    break;
                case Asc.c_oAscMathInterfaceType.EqArray:
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtInsertEqBefore,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'insert_Equation', value: true}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtInsertEqAfter,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'insert_Equation', value: false}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtDeleteEq,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'delete_Equation'}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.alignmentText,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        menu        : new Common.UI.Menu({
                            cls: 'shifted-right',
                            menuAlign: 'tl-tr',
                            items   : [
                                {
                                    caption: me.txtTop,
                                    checkable   : true,
                                    checked     : (value.get_Align()==Asc.c_oAscMathInterfaceEqArrayAlign.Top),
                                    equationProps: {type: type, callback: 'put_Align', value: Asc.c_oAscMathInterfaceEqArrayAlign.Top}
                                },
                                {
                                    caption: me.centerText,
                                    checkable   : true,
                                    checked     : (value.get_Align()==Asc.c_oAscMathInterfaceEqArrayAlign.Center),
                                    equationProps: {type: type, callback: 'put_Align', value: Asc.c_oAscMathInterfaceEqArrayAlign.Center}
                                },
                                {
                                    caption: me.txtBottom,
                                    checkable   : true,
                                    checked     : (value.get_Align()==Asc.c_oAscMathInterfaceEqArrayAlign.Bottom),
                                    equationProps: {type: type, callback: 'put_Align', value: Asc.c_oAscMathInterfaceEqArrayAlign.Bottom}
                                }
                            ]
                        })
                    });
                    arr.push(mnu);
                    break;
                case Asc.c_oAscMathInterfaceType.LargeOperator:
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtLimitChange,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'put_LimitLocation', value: (value.get_LimitLocation() == Asc.c_oAscMathInterfaceNaryLimitLocation.UndOvr) ? Asc.c_oAscMathInterfaceNaryLimitLocation.SubSup : Asc.c_oAscMathInterfaceNaryLimitLocation.UndOvr}
                    });
                    arr.push(mnu);
                    if (value.get_HideUpper() !== undefined) {
                        mnu = new Common.UI.MenuItem({
                            caption     : value.get_HideUpper() ? me.txtShowTopLimit : me.txtHideTopLimit,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_HideUpper', value: !value.get_HideUpper()}
                        });
                        arr.push(mnu);
                    }
                    if (value.get_HideLower() !== undefined) {
                        mnu = new Common.UI.MenuItem({
                            caption     : value.get_HideLower() ? me.txtShowBottomLimit : me.txtHideBottomLimit,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_HideLower', value: !value.get_HideLower()}
                        });
                        arr.push(mnu);
                    }
                    break;
                case Asc.c_oAscMathInterfaceType.Delimiter:
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtInsertArgBefore,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'insert_DelimiterArgument', value: true}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtInsertArgAfter,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'insert_DelimiterArgument', value: false}
                    });
                    arr.push(mnu);
                    if (value.can_DeleteArgument()) {
                        mnu = new Common.UI.MenuItem({
                            caption     : me.txtDeleteArg,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'delete_DelimiterArgument'}
                        });
                        arr.push(mnu);
                    }
                    mnu = new Common.UI.MenuItem({
                        caption     : value.has_Separators() ? me.txtDeleteCharsAndSeparators : me.txtDeleteChars,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'remove_DelimiterCharacters'}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : value.get_HideOpeningBracket() ? me.txtShowOpenBracket : me.txtHideOpenBracket,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'put_HideOpeningBracket', value: !value.get_HideOpeningBracket()}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : value.get_HideClosingBracket() ? me.txtShowCloseBracket : me.txtHideCloseBracket,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'put_HideClosingBracket', value: !value.get_HideClosingBracket()}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtStretchBrackets,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        checkable   : true,
                        checked     : value.get_StretchBrackets(),
                        equationProps: {type: type, callback: 'put_StretchBrackets', value: !value.get_StretchBrackets()}
                    });
                    arr.push(mnu);
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtMatchBrackets,
                        equation    : true,
                        disabled    : (!value.get_StretchBrackets() || me._currentParaObjDisabled),
                        checkable   : true,
                        checked     : value.get_StretchBrackets() && value.get_MatchBrackets(),
                        equationProps: {type: type, callback: 'put_MatchBrackets', value: !value.get_MatchBrackets()}
                    });
                    arr.push(mnu);
                    break;
                case Asc.c_oAscMathInterfaceType.GroupChar:
                    if (value.can_ChangePos()) {
                        mnu = new Common.UI.MenuItem({
                            caption     : (value.get_Pos()==Asc.c_oAscMathInterfaceGroupCharPos.Top) ? me.txtGroupCharUnder : me.txtGroupCharOver,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_Pos', value: (value.get_Pos()==Asc.c_oAscMathInterfaceGroupCharPos.Top) ? Asc.c_oAscMathInterfaceGroupCharPos.Bottom : Asc.c_oAscMathInterfaceGroupCharPos.Top}
                        });
                        arr.push(mnu);
                        mnu = new Common.UI.MenuItem({
                            caption     : me.txtDeleteGroupChar,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_Pos', value: Asc.c_oAscMathInterfaceGroupCharPos.None}
                        });
                        arr.push(mnu);
                    }
                    break;
                case Asc.c_oAscMathInterfaceType.Radical:
                    if (value.get_HideDegree() !== undefined) {
                        mnu = new Common.UI.MenuItem({
                            caption     : value.get_HideDegree() ? me.txtShowDegree : me.txtHideDegree,
                            equation    : true,
                            disabled    : me._currentParaObjDisabled,
                            equationProps: {type: type, callback: 'put_HideDegree', value: !value.get_HideDegree()}
                        });
                        arr.push(mnu);
                    }
                    mnu = new Common.UI.MenuItem({
                        caption     : me.txtDeleteRadical,
                        equation    : true,
                        disabled    : me._currentParaObjDisabled,
                        equationProps: {type: type, callback: 'remove_Radical'}
                    });
                    arr.push(mnu);
                    break;
            }
            if (value.can_IncreaseArgumentSize()) {
                mnu = new Common.UI.MenuItem({
                    caption     : me.txtIncreaseArg,
                    equation    : true,
                    disabled    : me._currentParaObjDisabled,
                    equationProps: {type: type, callback: 'increase_ArgumentSize'}
                });
                arr.push(mnu);
            }
            if (value.can_DecreaseArgumentSize()) {
                mnu = new Common.UI.MenuItem({
                    caption     : me.txtDecreaseArg,
                    equation    : true,
                    disabled    : me._currentParaObjDisabled,
                    equationProps: {type: type, callback: 'decrease_ArgumentSize'}
                });
                arr.push(mnu);
            }
            if (value.can_InsertManualBreak()) {
                mnu = new Common.UI.MenuItem({
                    caption     : me.txtInsertBreak,
                    equation    : true,
                    disabled    : me._currentParaObjDisabled,
                    equationProps: {type: type, callback: 'insert_ManualBreak'}
                });
                arr.push(mnu);
            }
            if (value.can_DeleteManualBreak()) {
                mnu = new Common.UI.MenuItem({
                    caption     : me.txtDeleteBreak,
                    equation    : true,
                    disabled    : me._currentParaObjDisabled,
                    equationProps: {type: type, callback: 'delete_ManualBreak'}
                });
                arr.push(mnu);
            }
            if (value.can_AlignToCharacter()) {
                mnu = new Common.UI.MenuItem({
                    caption     : me.txtAlignToChar,
                    equation    : true,
                    disabled    : me._currentParaObjDisabled,
                    equationProps: {type: type, callback: 'align_ToCharacter'}
                });
                arr.push(mnu);
            }
            return arr;
        };

        dh.updateCustomItems = function(menu, data) {
            if (!menu || !data || data.length<1) return;

            var me = this,
                lang = me.mode && me.mode.lang ? me.mode.lang.split(/[\-_]/)[0] : 'en';

            me._preventCustomClick && clearTimeout(me._preventCustomClick);
            me._hasCustomItems && (me._preventCustomClick = setTimeout(function () {
                me._preventCustomClick = null;
            },500)); // set delay only on update existing items
            me._hasCustomItems = true;

            var findCustomItem = function(guid, id) {
                if (menu && menu.items.length>0) {
                    for (var i = menu.items.length-1; i >=0 ; i--) {
                        if (menu.items[i].isCustomItem && (id===undefined && menu.items[i].options.guid === guid || menu.items[i].options.guid === guid && menu.items[i].value === id)) {
                            return menu.items[i];
                        }
                    }
                }
            }
            var getMenu = function(items, guid, toMenu) {
                var hasIcons = false;
                if (toMenu)
                    toMenu.removeAll();
                else {
                    toMenu = new Common.UI.Menu({
                        cls: 'shifted-right',
                        menuAlign: 'tl-tr',
                        items: []
                    });
                    toMenu.on('item:custom-click', function(menu, item, e) {
                        !me._preventCustomClick && me.api && me.api.onPluginContextMenuItemClick && me.api.onPluginContextMenuItemClick(item.options.guid, item.value);
                    });
                    toMenu.on('menu:click', function(menu, e) {
                        me._preventCustomClick && e.stopPropagation();
                    });
                }
                items.forEach(function(item) {
                    item.separator && toMenu.addItem(new Common.UI.MenuItemCustom({
                        caption: '--',
                        guid: guid
                    }));
                    item.text && toMenu.addItem(new Common.UI.MenuItemCustom({
                        caption: ((typeof item.text == 'object') ? item.text[lang] || item.text['en'] : item.text) || '',
                        value: item.id,
                        guid: guid,
                        menu: item.items ? getMenu(item.items, guid) : false,
                        iconsSet: item.icons,
                        baseUrl: '', // base url is included in icon path
                        disabled: !!item.disabled
                    }));
                    hasIcons = hasIcons || !!item.icons;
                });
                hasIcons && (toMenu.cmpEl ? toMenu.cmpEl.toggleClass('shifted-right', true) : (toMenu.options.cls = 'shifted-right'));
                return toMenu;
            }

            var focused;
            data.forEach(function(plugin) {
                var isnew = !findCustomItem(plugin.guid);
                if (plugin && plugin.items && plugin.items.length>0) {
                    plugin.items.forEach(function(item) {
                        if (item.separator && isnew) {// add separator only to new plugins menu
                            menu.addItem(new Common.UI.MenuItemCustom({
                                caption: '--',
                                guid: plugin.guid
                            }));
                        }

                        if (!item.text) return;
                        var mnu = findCustomItem(plugin.guid, item.id),
                            caption = ((typeof item.text == 'object') ? item.text[lang] || item.text['en'] : item.text) || '';
                        if (mnu) {
                            mnu.setCaption(caption);
                            mnu.setDisabled(!!item.disabled);
                            if (item.items) {
                                if (mnu.menu) {
                                    if (mnu.menu.isVisible() && mnu.menu.cmpEl.find(' > li:not(.divider):not(.disabled):visible').find('> a').filter(':focus').length>0) {
                                        mnu.menu.isOver = true;
                                        focused = mnu.cmpEl;
                                    }
                                    getMenu(item.items, plugin.guid, mnu.menu);
                                } else
                                    mnu.setMenu(getMenu(item.items, plugin.guid));
                            }
                        } else {
                            var mnu = new Common.UI.MenuItemCustom({
                                caption     : caption,
                                value: item.id,
                                guid: plugin.guid,
                                menu: item.items && item.items.length>=0 ? getMenu(item.items, plugin.guid) : false,
                                iconsSet: item.icons,
                                baseUrl: '', // base url is included in icon path
                                disabled: !!item.disabled
                            }).on('click', function(item, e) {
                                !me._preventCustomClick && me.api && me.api.onPluginContextMenuItemClick && me.api.onPluginContextMenuItemClick(item.options.guid, item.value);
                            });
                            menu.addItem(mnu);
                        }
                    });
                }
            });

            if (focused) {
                var $subitems = $('> [role=menu]', focused).find('> li:not(.divider):not(.disabled):visible > a');
                ($subitems.length>0) && $subitems.eq(0).focus();
            }
            menu.alignPosition();
        };

        dh.clearCustomItems = function(menu) {
            if (menu && menu.items.length>0) {
                for (var i = 0; i < menu.items.length; i++) {
                    if (menu.items[i].isCustomItem) {
                        menu.removeItem(menu.items[i]);
                        i--;
                    }
                }
            }
            this._hasCustomItems = false;
        };
    }

});






/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 *  CustomizeQuickAccessDialog.js
 *
 *  Created on 9/04/24
 *
 */

if (Common === undefined)
    var Common = {};

define('common/main/lib/view/CustomizeQuickAccessDialog',[], function () { 'use strict';

    Common.Views.CustomizeQuickAccessDialog = Common.UI.Window.extend(_.extend({
        options: {
            width: 296,
            style: 'min-width: 296px;',
            cls: 'modal-dlg quick-access-dlg',
            buttons: ['ok', 'cancel']
        },

        initialize : function(options) {
            _.extend(this.options, {
                title: this.textTitle
            }, options || {});

            this.template = [
                '<div class="box">',
                    '<label class="padding-medium">' + this.textMsg + '</label>',
                    '<div class="padding-small" id="quick-access-chb-save"></div>',
                    '<div class="padding-small" id="quick-access-chb-print"></div>',
                    '<div class="padding-small" id="quick-access-chb-quick-print" style="display:none;"></div>',
                    '<div class="padding-small" id="quick-access-chb-undo"></div>',
                    '<div class="padding-small" id="quick-access-chb-redo"></div>',
                    '<div class="padding-small" id="quick-access-chb-start-over" style="display:none;"></div>',
                '</div>'
            ].join('');

            this.options.tpl = _.template(this.template)(this.options);

            this.props = this.options.props;

            Common.UI.Window.prototype.initialize.call(this, this.options);
        },

        render: function() {
            Common.UI.Window.prototype.render.call(this);
            this.focusedComponents = [];

            var $window = this.getChild();
            $window.find('.dlg-btn').on('click', _.bind(this.onBtnClick, this));

            if (this.options.showSave) {
                this.chSave = new Common.UI.CheckBox({
                    el: $('#quick-access-chb-save'),
                    labelText: this.options.mode && (this.options.mode.canSaveToFile || this.options.mode.isDesktopApp && this.options.mode.isOffline) ? this.textSave : this.textDownload,
                    value: this.props.save
                });
                this.focusedComponents.push(this.chSave);
            }

            if (this.options.showPrint) {
                this.chPrint = new Common.UI.CheckBox({
                    el: $('#quick-access-chb-print'),
                    labelText: this.textPrint,
                    value: this.props.print
                });
                this.focusedComponents.push(this.chPrint);
            }

            if (this.options.showQuickPrint) {
                this.chQuickPrint = new Common.UI.CheckBox({
                    el: $('#quick-access-chb-quick-print'),
                    labelText: this.textQuickPrint,
                    value: this.props.quickPrint
                });
                this.focusedComponents.push(this.chQuickPrint);
                this.chQuickPrint.show();
            }

            this.chUndo = new Common.UI.CheckBox({
                el: $('#quick-access-chb-undo'),
                labelText: this.textUndo,
                value: this.props.undo
            });
            this.focusedComponents.push(this.chUndo);

            this.chRedo = new Common.UI.CheckBox({
                el: $('#quick-access-chb-redo'),
                labelText: this.textRedo,
                value: this.props.redo
            });
            this.focusedComponents.push(this.chRedo);

            if (!!window.PE) {
                this.chStartOver = new Common.UI.CheckBox({
                    el: $('#quick-access-chb-start-over'),
                    labelText: this.textStartOver,
                    value: this.props.startOver
                });
                this.focusedComponents.push(this.chStartOver);
                this.chStartOver.show();
            }    
        },

        getFocusedComponents: function() {
            return this.focusedComponents.concat(this.getFooterButtons());
        },

        getDefaultFocusableComponent: function () {
            return this.focusedComponents[0];
        },

        onBtnClick: function(event) {
            if (event.currentTarget.attributes['result'].value === 'ok') {
                Common.NotificationCenter.trigger('quickaccess:changed', {
                    save: this.chSave ? this.chSave.getValue() === 'checked' : undefined,
                    print: this.chPrint ? this.chPrint.getValue() === 'checked' : undefined,
                    quickPrint: this.chQuickPrint ? this.chQuickPrint.getValue() === 'checked' : undefined,
                    undo: this.chUndo.getValue() === 'checked',
                    redo: this.chRedo.getValue() === 'checked',
                    startOver: this.chStartOver ? this.chStartOver.getValue() === 'checked' : undefined
                });
            }

            this.close();
        },

        textTitle: 'Customize quick access',
        textMsg: 'Check the commands that will be displayed on the Quick Access Toolbar',
        textSave: 'Save',
        textPrint: 'Print',
        textQuickPrint: 'Quick Print',
        textUndo: 'Undo',
        textRedo: 'Redo',
        textDownload: 'Download file'
    }, Common.Views.CustomizeQuickAccessDialog || {}))
});
/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 *    FileMenuPanels.js
 *
 *    Contains views for menu 'File'
 *
 *    Created on 11/07/24
 *
 */

define('visioeditor/main/app/view/FileMenuPanels',[], function () {
    'use strict';

    !VE.Views.FileMenuPanels && (VE.Views.FileMenuPanels = {});

    VE.Views.FileMenuPanels.ViewSaveAs = Common.UI.BaseView.extend({
        el: '#panel-saveas',
        menu: undefined,

        formats: [[
            {name: 'VSDX',  imgCls: 'vsdx',  type: Asc.c_oAscFileType.VSDX},
            {name: 'PDF',   imgCls: 'pdf',   type: Asc.c_oAscFileType.PDF},
            {name: 'PDFA',  imgCls: 'pdfa',  type: Asc.c_oAscFileType.PDFA}
        ], [
            {name: 'JPG',   imgCls: 'jpg',  type: Asc.c_oAscFileType.JPG},
            {name: 'PNG',   imgCls: 'png',  type: Asc.c_oAscFileType.PNG}
        ]],


        template: _.template([
            '<div class="content-container">',
                '<div class="header"><%= header %></div>',
                '<div class="format-items">',
                    '<% _.each(rows, function(row) { %>',
                        '<% _.each(row, function(item) { %>',
                            '<div class="format-item float-left"><div class="btn-doc-format" format="<%= item.type %>" data-hint="2" data-hint-direction="left-top" data-hint-offset="4, 4">',
                                '<div class ="svg-format-<%= item.imgCls %>"></div>',
                            '</div></div>',
                        '<% }) %>',
                        '<div class="divider"></div>',
                    '<% }) %>',
                '</div>',
            '</div>'
        ].join('')),

        initialize: function(options) {
            Common.UI.BaseView.prototype.initialize.call(this,arguments);

            this.menu = options.menu;
            this.fileType = options.fileType;

            Common.NotificationCenter.on({
                'window:resize': _.bind(function() {
                    var divided = Common.Utils.innerWidth() >= this.maxWidth;
                    if (this.isDivided !== divided) {
                        this.$el.find('.divider').css('width', divided ? '100%' : '0');
                        this.isDivided = divided;
                    }
                }, this)
            });
        },

        render: function() {
            this.$el.html(this.template({rows:this.formats,
                fileType: (this.fileType || 'vsdx').toLowerCase(),
                header: /*this.textDownloadAs*/ Common.Locale.get('btnDownloadCaption', {name:'VE.Views.FileMenu', default:this.textDownloadAs})}));
            $('.btn-doc-format',this.el).on('click', _.bind(this.onFormatClick,this));

            if (_.isUndefined(this.scroller)) {
                this.scroller = new Common.UI.Scroller({
                    el: this.$el,
                    suppressScrollX: true,
                    alwaysVisibleY: true
                });
            }

            var itemWidth = 70 + 24, // width + margin
                maxCount = 0;
            this.formats.forEach(_.bind(function (item, index) {
                var count = item.length;
                if (count > maxCount) {
                    maxCount = count;
                }
            }, this));
            this.maxWidth = $('#file-menu-panel .panel-menu').outerWidth() + 20 + 10 + itemWidth * maxCount; // menu + left padding + margin

            if (Common.Utils.innerWidth() >= this.maxWidth) {
                this.$el.find('.divider').css('width', '100%');
                this.isDivided = true;
            }

            return this;
        },

        show: function() {
            Common.UI.BaseView.prototype.show.call(this,arguments);
            this.scroller && this.scroller.update();
        },

        onFormatClick: function(e) {
            var type = e.currentTarget.attributes['format'];
            if (!_.isUndefined(type) && this.menu) {
                this.menu.fireEvent('saveas:format', [this.menu, parseInt(type.value)]);
            }
        },

        textDownloadAs: "Download as"
    });

    VE.Views.FileMenuPanels.ViewSaveCopy = Common.UI.BaseView.extend({
        el: '#panel-savecopy',
        menu: undefined,

        formats: [[
            {name: 'VSDX',  imgCls: 'vsdx',  type: Asc.c_oAscFileType.VSDX, ext: '.vsdx'},
            {name: 'PDF',   imgCls: 'pdf',   type: Asc.c_oAscFileType.PDF, ext: '.pdf'},
            {name: 'PDFA',  imgCls: 'pdfa',  type: Asc.c_oAscFileType.PDFA, ext: '.pdf'}
        ], [
            {name: 'JPG',   imgCls: 'jpg',  type: Asc.c_oAscFileType.JPG, ext: '.zip'},
            {name: 'PNG',   imgCls: 'png',  type: Asc.c_oAscFileType.PNG, ext: '.zip'}
        ]],

        template: _.template([
            '<div class="content-container">',
                '<div class="header"><%= header %></div>',
                '<div class="format-items">',
                    '<% _.each(rows, function(row) { %>',
                        '<% _.each(row, function(item) { %>',
                            '<div class="format-item float-left"><div class="btn-doc-format" format="<%= item.type %>" format-ext="<%= item.ext %>" data-hint="2" data-hint-direction="left-top" data-hint-offset="4, 4">',
                                '<div class ="svg-format-<%= item.imgCls %>"></div>',
                            '</div></div>',
                        '<% }) %>',
                        '<div class="divider"></div>',
                    '<% }) %>',
                '</div>',
            '</div>'
        ].join('')),

        initialize: function(options) {
            Common.UI.BaseView.prototype.initialize.call(this,arguments);

            this.menu = options.menu;
            this.fileType = options.fileType;

            Common.NotificationCenter.on({
                'window:resize': _.bind(function() {
                    var divided = Common.Utils.innerWidth() >= this.maxWidth;
                    if (this.isDivided !== divided) {
                        this.$el.find('.divider').css('width', divided ? '100%' : '0');
                        this.isDivided = divided;
                    }
                }, this)
            });
        },

        render: function() {
            this.$el.html(this.template({rows:this.formats,
                fileType: (this.fileType || 'vsdx').toLowerCase(),
                header: /*this.textSaveCopyAs*/ Common.Locale.get('btnSaveCopyAsCaption', {name:'VE.Views.FileMenu', default:this.textSaveCopyAs})}));
            $('.btn-doc-format',this.el).on('click', _.bind(this.onFormatClick,this));

            if (_.isUndefined(this.scroller)) {
                this.scroller = new Common.UI.Scroller({
                    el: this.$el,
                    suppressScrollX: true,
                    alwaysVisibleY: true
                });
            }

            var itemWidth = 70 + 24, // width + margin
                maxCount = 0;
            this.formats.forEach(_.bind(function (item, index) {
                var count = item.length;
                if (count > maxCount) {
                    maxCount = count;
                }
            }, this));
            this.maxWidth = $('#file-menu-panel .panel-menu').outerWidth() + 20 + 10 + itemWidth * maxCount; // menu + left padding + margin

            if (Common.Utils.innerWidth() >= this.maxWidth) {
                this.$el.find('.divider').css('width', '100%');
                this.isDivided = true;
            }

            return this;
        },

        show: function() {
            Common.UI.BaseView.prototype.show.call(this,arguments);
            this.scroller && this.scroller.update();
        },

        onFormatClick: function(e) {
            var type = e.currentTarget.attributes['format'],
                ext = e.currentTarget.attributes['format-ext'];
            if (!_.isUndefined(type) && !_.isUndefined(ext) && this.menu) {
                this.menu.fireEvent('savecopy:format', [this.menu, parseInt(type.value), ext.value]);
            }
        },

        textSaveCopyAs: "Save Copy as"
    });

    VE.Views.FileMenuPanels.Settings = Common.UI.BaseView.extend(_.extend({
        el: '#panel-settings',
        menu: undefined,

        template: _.template([
        '<div class="flex-settings">',
            '<div class="header"><%= scope.txtAdvancedSettings %></div>',
            '<table><tbody>',
                '<tr class="appearance">',
                    '<td colspan="2" class="group-name"><label><%= scope.txtAppearance %></label></td>',
                '</tr>',
                '<tr class="themes">',
                    '<td><label><%= scope.strTheme %></label></td>',
                    '<td><span id="fms-cmb-theme"></span></td>',
                '</tr>',
                '<tr class="tab-style">',
                    '<td><label><%= scope.strTabStyle %></label></td>',
                    '<td><div id="fms-cmb-tab-style"></div></td>',
                '</tr>',
                '<tr class="tab-background">',
                    '<td colspan="2"><div id="fms-chb-tab-background"></div></td>',
                '</tr>',
                '<tr class ="edit divider-group"></tr>',
                '<tr>',
                    '<td colspan="2" class="group-name"><label><%= scope.txtWorkspace %></label></td>',
                    '</tr>',
                '<tr>',
                    '<td colspan="2"><div id="fms-chb-scrn-reader"></div></td>',
                '</tr>',
                '<tr>',
                    '<td colspan="2"><div id="fms-chb-use-alt-key"></div></td>',
                '</tr>',
                '<tr class="edit quick-access">',
                    '<td colspan="2"><button type="button" class="btn btn-text-default" id="fms-btn-customize-quick-access" style="width:auto;display:inline-block;padding-right:10px;padding-left:10px;" data-hint="2" data-hint-direction="bottom" data-hint-offset="medium"><%= scope.txtCustomizeQuickAccess %></button></div></td>',
                '</tr>',
                '<tr>',
                    '<td><label><%= scope.strZoom %></label></td>',
                    '<td><div id="fms-cmb-zoom" class="input-group-nr"></div></td>',
                '</tr>',
                '<tr>',
                    '<td><label><%= scope.strFontRender %></label></td>',
                    '<td><span id="fms-cmb-font-render"></span></td>',
                '</tr>',
                // '<tr>',
                //     '<td><label><%= scope.strKeyboardShortcuts %></label></td>',
                //     '<td colspan="2"><button type="button" class="btn btn-text-default" id="fms-btn-keyboard-shortcuts" style="width:auto; display: inline-block;padding-right: 10px;padding-left: 10px;" data-hint="2" data-hint-direction="bottom" data-hint-offset="medium"><%= scope.txtCustomize %></button></div></td>',
                // '</tr>',
                // '<tr class="macros">',
                //     '<td><label><%= scope.strMacrosSettings %></label></td>',
                //     '<td><div><div id="fms-cmb-macros"></div></div></td>',
                // '</tr>',
                '<tr class ="divider-group"></tr>',
                '<tr class="fms-btn-apply">',
                    '<td style="padding-top:15px; padding-bottom: 15px;"><button class="btn normal dlg-btn primary" data-hint="2" data-hint-direction="bottom" data-hint-offset="medium"><%= scope.okButtonText %></button></td>',
                    '<td></td>',
                '</tr>',
            '</tbody></table>',
        '</div>',
        '<div class="fms-flex-apply hidden">',
            '<table style="margin: 10px 20px;"><tbody>',
                '<tr>',
                    '<td><button class="btn normal dlg-btn primary" data-hint="2" data-hint-direction="bottom" data-hint-offset="big"><%= scope.okButtonText %></button></td>',
                    '<td></td>',
                '</tr>',
            '</tbody></table>',
        '</div>'
        ].join('')),

        initialize: function(options) {
            Common.UI.BaseView.prototype.initialize.call(this,arguments);

            this.menu = options.menu;
        },

        render: function(node) {
            var me = this;
            var $markup = $(this.template({scope: this}));


            this.chUseAltKey = new Common.UI.CheckBox({
                el: $markup.findById('#fms-chb-use-alt-key'),
                labelText: Common.Utils.isMac ? this.txtUseOptionKey : this.txtUseAltKey,
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            });
            (Common.Utils.isIE || Common.Utils.isMac && Common.Utils.isGecko) && this.chUseAltKey.$el.parent().parent().hide();

            this.chScreenReader = new Common.UI.CheckBox({
                el: $markup.findById('#fms-chb-scrn-reader'),
                labelText: this.txtScreenReader,
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            });

            this.cmbZoom = new Common.UI.ComboBox({
                el          : $markup.findById('#fms-cmb-zoom'),
                style       : 'width: 160px;',
                editable    : false,
                restoreMenuHeightAndTop: true,
                cls         : 'input-group-nr',
                menuStyle   : 'min-width:100%; max-height: 157px;',
                data        : [
                    { value: -3, displayValue: this.txtLastUsed },
                    { value: -1, displayValue: this.txtFitPage },
                    { value: -2, displayValue: this.txtFitWidth },
                    { value: 50, displayValue: "50%" },
                    { value: 60, displayValue: "60%" },
                    { value: 70, displayValue: "70%" },
                    { value: 80, displayValue: "80%" },
                    { value: 90, displayValue: "90%" },
                    { value: 100, displayValue: "100%" },
                    { value: 110, displayValue: "110%" },
                    { value: 120, displayValue: "120%" },
                    { value: 150, displayValue: "150%" },
                    { value: 175, displayValue: "175%" },
                    { value: 200, displayValue: "200%" },
                    { value: 300, displayValue: "300%" },
                    { value: 400, displayValue: "400%" },
                    { value: 500, displayValue: "500%" }
                ],
                dataHint: '2',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big'
            });

            var itemsTemplate =
                _.template([
                    '<% _.each(items, function(item) { %>',
                    '<li id="<%= item.id %>" data-value="<%= item.value %>" <% if (item.value === "custom") { %> class="border-top" <% } %> ><a tabindex="-1" type="menuitem" <% if (typeof(item.checked) !== "undefined" && item.checked) { %> class="checked" <% } %> ><%= scope.getDisplayValue(item) %></a></li>',
                    '<% }); %>'
                ].join(''));
            this.cmbFontRender = new Common.UI.ComboBox({
                el          : $markup.findById('#fms-cmb-font-render'),
                style       : 'width: 160px;',
                editable    : false,
                restoreMenuHeightAndTop: true,
                menuStyle   : 'min-width:100%;',
                cls         : 'input-group-nr',
                itemsTemplate: itemsTemplate,
                data        : [
                    { value: Asc.c_oAscFontRenderingModeType.hintingAndSubpixeling, displayValue: this.txtWin },
                    { value: Asc.c_oAscFontRenderingModeType.noHinting, displayValue: this.txtMac },
                    { value: Asc.c_oAscFontRenderingModeType.hinting, displayValue: this.txtNative },
                    { value: 'custom', displayValue: this.txtCacheMode }
                ],
                dataHint: '2',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big'
            });
            this.cmbFontRender.on('selected', _.bind(this.onFontRenderSelected, this));

            // this.btnKeyboardMacros = new Common.UI.Button({
            //     el: $markup.findById('#fms-btn-keyboard-shortcuts')
            // });
            // this.btnKeyboardMacros.on('click', _.bind(this.onClickKeyboardShortcut, this));

            // this.cmbMacros = new Common.UI.ComboBox({
            //     el          : $markup.findById('#fms-cmb-macros'),
            //     style       : 'width: 160px;',
            //     editable    : false,
            //     restoreMenuHeightAndTop: true,
            //     menuStyle   : 'min-width:100%;',
            //     cls         : 'input-group-nr',
            //     data        : [
            //         { value: 2, displayValue: this.txtStopMacros, descValue: this.txtStopMacrosDesc },
            //         { value: 0, displayValue: this.txtWarnMacros, descValue: this.txtWarnMacrosDesc },
            //         { value: 1, displayValue: this.txtRunMacros, descValue: this.txtRunMacrosDesc }
            //     ],
            //     itemsTemplate: _.template([
            //         '<% _.each(items, function(item) { %>',
            //         '<li id="<%= item.id %>" data-value="<%- item.value %>"><a tabindex="-1" type="menuitem" style ="display: flex; flex-direction: column;">',
            //         '<label class="font-weight-bold"><%= scope.getDisplayValue(item) %></label><label><%= item.descValue %></label></a></li>',
            //         '<% }); %>'
            //     ].join('')),
            //     dataHint: '2',
            //     dataHintDirection: 'bottom',
            //     dataHintOffset: 'big'
            // }).on('selected', function(combo, record) {
            //     me.lblMacrosDesc.text(record.descValue);
            // });
            // this.lblMacrosDesc = $markup.findById('#fms-lbl-macros');

            this.btnCustomizeQuickAccess = new Common.UI.Button({
                el: $markup.findById('#fms-btn-customize-quick-access')
            });
            this.btnCustomizeQuickAccess.on('click', _.bind(this.customizeQuickAccess, this));

            this.cmbTheme = new Common.UI.ComboBox({
                el          : $markup.findById('#fms-cmb-theme'),
                style       : 'width: 160px;',
                editable    : false,
                restoreMenuHeightAndTop: true,
                menuStyle   : 'min-width:100%;',
                cls         : 'input-group-nr',
                dataHint    : '2',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big'
            });

            this.cmbTabStyle = new Common.UI.ComboBox({
                el          : $markup.findById('#fms-cmb-tab-style'),
                style       : 'width: 160px;',
                menuStyle   : 'min-width:100%;',
                editable    : false,
                restoreMenuHeightAndTop: true,
                cls         : 'input-group-nr',
                data        : [
                    {value: 'fill', displayValue: this.textFill},
                    {value: 'line', displayValue: this.textLine}
                ],
                dataHint: '2',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big'
            }).on('selected', function(combo, record) {
                me._isTabStyleChanged = true;
            });

            this.chTabBack = new Common.UI.CheckBox({
                el: $markup.findById('#fms-chb-tab-background'),
                labelText: this.txtTabBack,
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            });

            $markup.find('.btn.primary').each(function(index, el){
                (new Common.UI.Button({
                    el: $(el)
                })).on('click', _.bind(me.applySettings, me));
            });

            /*this.chQuickPrint = new Common.UI.CheckBox({
                el: $markup.findById('#fms-chb-quick-print'),
                labelText: '',
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            });
            this.chQuickPrint.$el.parent().on('click', function (){
                me.chQuickPrint.setValue(!me.chQuickPrint.isChecked());
            });*/

            this.pnlSettings = $markup.find('.flex-settings').addBack().filter('.flex-settings');
            this.pnlApply = $markup.find('.fms-flex-apply').addBack().filter('.fms-flex-apply');
            this.pnlTable = this.pnlSettings.find('table');
            this.trApply = $markup.find('.fms-btn-apply');

            this.$el = $(node).html($markup);

            if (_.isUndefined(this.scroller)) {
                this.scroller = new Common.UI.Scroller({
                    el: this.pnlSettings,
                    suppressScrollX: true,
                    alwaysVisibleY: true
                });
            }

            Common.NotificationCenter.on({
                'window:resize': function() {
                    me.isVisible() && me.updateScroller();
                }
            });

            return this;
        },

        show: function() {
            Common.UI.BaseView.prototype.show.call(this,arguments);

            this.updateSettings();
            this.updateScroller();
        },

        updateScroller: function() {
            if (this.scroller) {
                Common.UI.Menu.Manager.hideAll();
                var scrolled = this.$el.height() < this.pnlTable.parent().height() + 25 + this.pnlApply.height();
                this.pnlApply.toggleClass('hidden', !scrolled);
                this.trApply.toggleClass('hidden', scrolled);
                this.pnlSettings.css('overflow', scrolled ? 'hidden' : 'visible');
                this.scroller.update();
                this.pnlSettings.toggleClass('bordered', this.scroller.isVisible());
                this.cmbZoom.options.menuAlignEl = scrolled ? this.pnlSettings : null;
                this.cmbFontRender.options.menuAlignEl = scrolled ? this.pnlSettings : null;
                this.cmbTheme.options.menuAlignEl = scrolled ? this.pnlSettings : null;
                // this.cmbMacros.options.menuAlignEl = scrolled ? this.pnlSettings : null;
                this.cmbTabStyle.options.menuAlignEl = scrolled ? this.pnlSettings : null;
            }
        },

        setMode: function(mode) {
            this.mode = mode;

            $('tr.edit', this.el)[mode.isEdit?'show':'hide']();
            $('tr.macros', this.el)[(mode.customization && mode.customization.macros===false) ? 'hide' : 'show']();
            $('tr.quick-print', this.el)[mode.canQuickPrint && !(mode.compactHeader && mode.isEdit) ? 'show' : 'hide']();
            $('tr.tab-background', this.el)[!Common.Utils.isIE && Common.UI.FeaturesManager.canChange('tabBackground', true) ? 'show' : 'hide']();
            $('tr.tab-style', this.el)[!Common.Utils.isIE && !Common.Controllers.Desktop.isWinXp() && Common.UI.FeaturesManager.canChange('tabStyle', true) ? 'show' : 'hide']();
            if ( !Common.UI.Themes.available() ) {
                $('tr.themes, tr.themes + tr.divider', this.el).hide();
            }
            $('tr.appearance', this.el)[!Common.Utils.isIE ? 'show' : 'hide']();
            if (mode.compactHeader) {
                $('tr.quick-access', this.el).hide();
            }
        },

        setApi: function(o) {
            this.api = o;
            return this;
        },

        updateSettings: function() {
            this.chUseAltKey.setValue(Common.Utils.InternalSettings.get("ve-settings-show-alt-hints"));
            this.chScreenReader.setValue(Common.Utils.InternalSettings.get("app-settings-screen-reader"));

            var value = Common.Utils.InternalSettings.get("ve-settings-zoom");
            value = (value!==null) ? parseInt(value) : (this.mode.customization && this.mode.customization.zoom ? parseInt(this.mode.customization.zoom) : -1);
            var item = this.cmbZoom.store.findWhere({value: value});
            this.cmbZoom.setValue(item ? parseInt(item.get('value')) : (value>0 ? value+'%' : 100));

            value = Common.Utils.InternalSettings.get("ve-settings-fontrender");
            item = this.cmbFontRender.store.findWhere({value: parseInt(value)});
            this.cmbFontRender.setValue(item ? item.get('value') : Asc.c_oAscFontRenderingModeType.hintingAndSubpixeling);
            this._fontRender = this.cmbFontRender.getValue();

            value = Common.Utils.InternalSettings.get("ve-settings-cachemode");
            item = this.cmbFontRender.store.findWhere({value: 'custom'});
            item && value && item.set('checked', !!value);
            item && value && this.cmbFontRender.cmpEl.find('#' + item.get('id') + ' a').addClass('checked');

            // item = this.cmbMacros.store.findWhere({value: Common.Utils.InternalSettings.get("ve-macros-mode")});
            // this.cmbMacros.setValue(item ? item.get('value') : 0);
            // this.lblMacrosDesc.text(item ? item.get('descValue') : this.txtWarnMacrosDesc);

            var data = [];
            for (var t in Common.UI.Themes.map()) {
                data.push({value: t, displayValue: Common.UI.Themes.get(t).text});
            }

            if ( data.length ) {
                this.cmbTheme.setData(data);
                item = this.cmbTheme.store.findWhere({value: Common.UI.Themes.currentThemeId()});
                this.cmbTheme.setValue(item ? item.get('value') : Common.UI.Themes.defaultThemeId());
            }
            this.chTabBack.setValue(Common.Utils.InternalSettings.get("settings-tab-background")==='toolbar');
            value = Common.Utils.InternalSettings.get("settings-tab-style");
            item = this.cmbTabStyle.store.findWhere({value: value});
            this.cmbTabStyle.setValue(item ? item.get('value') : 'fill');
        },

        applySettings: function() {
            Common.UI.Themes.setTheme(this.cmbTheme.getValue());
            Common.localStorage.setItem("ve-settings-show-alt-hints", this.chUseAltKey.isChecked() ? 1 : 0);
            Common.Utils.InternalSettings.set("ve-settings-show-alt-hints", Common.localStorage.getBool("ve-settings-show-alt-hints"));
            Common.localStorage.setItem("ve-settings-zoom", this.cmbZoom.getValue());
            Common.localStorage.setItem("app-settings-screen-reader", this.chScreenReader.isChecked() ? 1 : 0);
            Common.localStorage.setItem("ve-settings-fontrender", this.cmbFontRender.getValue());
            var item = this.cmbFontRender.store.findWhere({value: 'custom'});
            Common.localStorage.setItem("ve-settings-cachemode", item && !item.get('checked') ? 0 : 1);
            // Common.localStorage.setItem("ve-macros-mode", this.cmbMacros.getValue());
            // Common.Utils.InternalSettings.set("ve-macros-mode", this.cmbMacros.getValue());

            if (!Common.Utils.isIE && Common.UI.FeaturesManager.canChange('tabBackground', true)) {
                Common.UI.TabStyler.setBackground(this.chTabBack.isChecked() ? 'toolbar' : 'header');
            }
            if (!Common.Utils.isIE && Common.UI.FeaturesManager.canChange('tabStyle', true) && this._isTabStyleChanged) {
                Common.UI.TabStyler.setStyle(this.cmbTabStyle.getValue());
                Common.localStorage.setBool("settings-tab-style-newtheme", true); // use tab style from lc for all themes
                this._isTabStyleChanged = false;
            }
            Common.localStorage.save();

            if (this.menu) {
                this.menu.fireEvent('settings:apply', [this.menu]);
            }
        },

        onFontRenderSelected: function(combo, record) {
            if (record.value == 'custom') {
                var item = combo.store.findWhere({value: 'custom'});
                item && item.set('checked', !record.checked);
                combo.cmpEl.find('#' + record.id + ' a').toggleClass('checked', !record.checked);
                combo.setValue(this._fontRender);
            }
            this._fontRender = combo.getValue();
        },

        // onClickKeyboardShortcut: function() {
        //     const win = new Common.Views.ShortcutsDialog({
        //         api: this.api
        //     });
        //     win.show();
        //     Common.localStorage.setItem('help-tip-customize-shortcuts', 1); // don't show new feature label
        // },

        customizeQuickAccess: function () {
            if (this.dlgQuickAccess && this.dlgQuickAccess.isVisible()) return;
            this.dlgQuickAccess = new Common.Views.CustomizeQuickAccessDialog({
                showSave: this.mode.showSaveButton && Common.UI.LayoutManager.isElementVisible('header-save'),
                showPrint: this.mode.canPrint && this.mode.twoLevelHeader,
                showQuickPrint: this.mode.canQuickPrint && this.mode.twoLevelHeader,
                mode: this.mode,
                props: {
                    print: Common.localStorage.getBool('ve-quick-access-print', true),
                    quickPrint: Common.localStorage.getBool('ve-quick-access-quick-print', true)
                }
            });
            this.dlgQuickAccess.show();
        },

        strZoom: 'Default Zoom Value',
        okButtonText: 'Apply',
        txtFitPage: 'Fit to Page',
        txtWin: 'as Windows',
        txtMac: 'as OS X',
        txtNative: 'Native',
        strFontRender: 'Font Hinting',
        strKeyboardShortcuts: 'Keyboard Shortcuts',
        txtCustomize: 'Customize',
        txtFitWidth: 'Fit to Width',
        txtCacheMode: 'Default cache mode',
        strMacrosSettings: 'Macros Settings',
        txtWarnMacros: 'Show Notification',
        txtRunMacros: 'Enable All',
        txtStopMacros: 'Disable All',
        txtWarnMacrosDesc: 'Disable all macros with notification',
        txtRunMacrosDesc: 'Enable all macros without notification',
        txtStopMacrosDesc: 'Disable all macros without notification',
        strTheme: 'Theme',
        txtThemeLight: 'Light',
        txtThemeDark: 'Dark',
        txtWorkspace: 'Workspace',
        txtUseAltKey: 'Use Alt key to navigate the user interface using the keyboard',
        txtUseOptionKey: 'Use Option key to navigate the user interface using the keyboard',
        txtAdvancedSettings: 'Advanced Settings',
        txtQuickPrint: 'Show the Quick Print button in the editor header',
        txtQuickPrintTip: 'The document will be printed on the last selected or default printer',
        txtLastUsed: 'Last used',
        txtScreenReader: 'Turn on screen reader support',
        txtCustomizeQuickAccess: 'Customize quick access',
        txtTabBack: 'Use toolbar color as tabs background',
        strTabStyle: 'Tab style',
        textFill: 'Fill',
        textLine: 'Line',
        txtAppearance: 'Appearance'
    }, VE.Views.FileMenuPanels.Settings || {}));

    VE.Views.FileMenuPanels.CreateNew = Common.UI.BaseView.extend(_.extend({
        el: '#panel-createnew',
        menu: undefined,

        events: function() {
            return {
                'click .blank-document':_.bind(this._onBlankDocument, this),
                'click .thumb-list .thumb-wrap': _.bind(this._onDocumentTemplate, this)
            };
        },

        template: _.template([
            '<div class="header"><%= scope.txtCreateNew %></div>',
            '<div class="thumb-list">',
                '<% if (blank) { %> ',
                '<div class="blank-document" data-hint="2" data-hint-direction="left-top" data-hint-offset="22, 13">',
                    '<div class="blank-document-btn">',
                        '<div class="btn-blank-format"><div class="svg-format-blank"></div></div>',
                    '</div>',
                    '<div class="title"><%= scope.txtBlank %></div>',
                '</div>',
                '<% } %>',
                '<% _.each(docs, function(item, index) { %>',
                    '<div class="thumb-wrap" template="<%= item.url %>" data-hint="2" data-hint-direction="left-top" data-hint-offset="22, 13">',
                        '<div class="thumb" ',
                        '<%  if (!_.isEmpty(item.image)) {%> ',
                            ' style="background-image: url(<%= item.image %>);">',
                        ' <%} else {' +
                            'print(\"><div class=\'btn-blank-format\'><div class=\'svg-file-template\'></div></div>\")' +
                        ' } %>',
                        '</div>',
                        '<div class="title"><%= Common.Utils.String.htmlEncode(item.title || item.name || "") %></div>',
                    '</div>',
                '<% }) %>',
            '</div>'
        ].join('')),
        
        initialize: function(options) {
            Common.UI.BaseView.prototype.initialize.call(this,arguments);

            this.menu = options.menu;
            this.docs = options.docs;
            this.blank = !!options.blank;
        },

        render: function() {
            this.$el.html(this.template({
                scope: this,
                docs: this.docs,
                blank: this.blank
            }));
            var docs = (this.blank ? [{title: this.txtBlank}] : []).concat(this.docs);
            var thumbsElm= this.$el.find('.thumb-wrap, .blank-document');
            _.each(thumbsElm, function (tmb, index){
                $(tmb).find('.title').tooltip({
                    title       : docs[index].title,
                    placement   : 'cursor'
                });
            });

            if (_.isUndefined(this.scroller)) {
                this.scroller = new Common.UI.Scroller({
                    el: this.$el,
                    suppressScrollX: true,
                    alwaysVisibleY: true
                });
            }

            return this;
        },

        show: function() {
            Common.UI.BaseView.prototype.show.call(this,arguments);
            this.scroller && this.scroller.update();
        },

        _onBlankDocument: function() {
            if ( this.menu )
                this.menu.fireEvent('create:new', [this.menu, 'blank']);
        },

        _onDocumentTemplate: function(e) {
            if ( this.menu )
                this.menu.fireEvent('create:new', [this.menu, e.currentTarget.attributes['template'].value]);
        },

        txtBlank: 'Blank document',
        txtCreateNew: 'Create New'
    }, VE.Views.FileMenuPanels.CreateNew || {}));

    VE.Views.FileMenuPanels.DocumentInfo = Common.UI.BaseView.extend(_.extend({
        el: '#panel-info',
        menu: undefined,

        initialize: function(options) {
            Common.UI.BaseView.prototype.initialize.call(this,arguments);
            this.rendered = false;

            this.template = _.template([
                '<table class="main">',
                    '<tbody><td class="header">' + this.txtVisioInfo + '</td></tbody>',
                    '<tbody>',
                        '<tr><td class="title"><label>' + this.txtCommon + '</label></td></tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtPlacement + '</label></td>',
                            '<td class="right"><label id="id-info-placement">-</label></td>',
                        '</tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtOwner + '</label></td>',
                            '<td class="right"><label id="id-info-owner">-</label></td>',
                        '</tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtUploaded + '</label></td>',
                            '<td class="right"><label id="id-info-uploaded">-</label></td>',
                        '</tr>',
                        '<tr></tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtModifyDate + '</label></td>',
                            '<td class="right"><label id="id-info-modify-date"></label></td>',
                        '</tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtModifyBy + '</label></td>',
                            '<td class="right"><label id="id-info-modify-by"></label></td>',
                        '</tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtCreated + '</label></td>',
                            '<td class="right"><label id="id-info-date"></label></td>',
                        '</tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtAppName + '</label></td>',
                            '<td class="right"><label id="id-info-appname"></label></td>',
                        '</tr>',
                    '</tbody>',
                    '<tbody class="properties-tab">',
                        '<tr><td class="title"><label>' + this.txtProperties + '</label></td></tr>',
                        '<tr class="author-info">',
                            '<td class="left"><label>' + this.txtAuthor + '</label></td>',
                            '<td class="right"><div id="id-info-author">',
                                '<table>',
                                    '<tr>',
                                        '<td><div id="id-info-add-author"><input type="text" spellcheck="false" class="form-control" placeholder="' +  this.txtAddAuthor +'"></div></td>',
                                    '</tr>',
                                '</table>',
                            '</div></td>',
                        '</tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtTitle + '</label></td>',
                            '<td class="right"><div id="id-info-title"></div></td>',
                        '</tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtTags + '</label></td>',
                            '<td class="right"><div id="id-info-tags"></div></td>',
                        '</tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtSubject + '</label></td>',
                            '<td class="right"><div id="id-info-subject"></div></td>',
                        '</tr>',
                        '<tr>',
                            '<td class="left"><label>' + this.txtComment + '</label></td>',
                            '<td class="right"><div id="id-info-comment"></div></td>',
                        '</tr>',
                    '</tbody>',
                '</table>',
            ].join(''));

            this.menu = options.menu;
            this.coreProps = null;
            this.authors = [];
            this._locked = false;
        },

        render: function(node) {
            var me = this;
            var $markup = $(me.template({scope: me}));

            // server info
            this.lblPlacement = $markup.findById('#id-info-placement');
            this.lblOwner = $markup.findById('#id-info-owner');
            this.lblUploaded = $markup.findById('#id-info-uploaded');

            // edited info
            var keyDownBefore = function(input, e){
                if (e.keyCode === Common.UI.Keys.ESC) {
                    var newVal = input._input.val(),
                        oldVal = input.getValue();
                    if (newVal !== oldVal) {
                        input.setValue(oldVal);
                        e.stopPropagation();
                    }
                }
            };

            this.inputTitle = new Common.UI.InputField({
                el          : $markup.findById('#id-info-title'),
                style       : 'width: 200px;',
                placeHolder : this.txtAddText,
                validateOnBlur: false,
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            }).on('keydown:before', keyDownBefore).on('changed:after', function(_, newValue) {
                me.coreProps.asc_putTitle(newValue);
                me.api.asc_setCoreProps(me.coreProps);
            });

            this.inputTags = new Common.UI.InputField({
                el          : $markup.findById('#id-info-tags'),
                style       : 'width: 200px;',
                placeHolder : this.txtAddText,
                validateOnBlur: false,
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            }).on('keydown:before', keyDownBefore).on('changed:after', function(_, newValue) {
                me.coreProps.asc_putKeywords(newValue);
                me.api.asc_setCoreProps(me.coreProps);
            });

            this.inputSubject = new Common.UI.InputField({
                el          : $markup.findById('#id-info-subject'),
                style       : 'width: 200px;',
                placeHolder : this.txtAddText,
                validateOnBlur: false,
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            }).on('keydown:before', keyDownBefore).on('changed:after', function(_, newValue) {
                me.coreProps.asc_putSubject(newValue);
                me.api.asc_setCoreProps(me.coreProps);
            });

            this.inputComment = new Common.UI.InputField({
                el          : $markup.findById('#id-info-comment'),
                style       : 'width: 200px;',
                placeHolder : this.txtAddText,
                validateOnBlur: false,
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            }).on('keydown:before', keyDownBefore).on('changed:after', function(_, newValue) {
                me.coreProps.asc_putDescription(newValue);
                me.api.asc_setCoreProps(me.coreProps);
            });

            // modify info
            this.lblModifyDate = $markup.findById('#id-info-modify-date');
            this.lblModifyBy = $markup.findById('#id-info-modify-by');

            // creation info
            this.lblDate = $markup.findById('#id-info-date');
            this.lblApplication = $markup.findById('#id-info-appname');
            this.tblAuthor = $markup.findById('#id-info-author table');
            this.trAuthor = $markup.findById('#id-info-add-author').closest('tr');
            this.authorTpl = '<tr><td><div style="display: inline-block;width: 200px;"><input type="text" spellcheck="false" class="form-control" readonly="true" value="{0}" ></div><div class="tool close img-colored" data-hint="2" data-hint-direction="right" data-hint-offset="small"></div></td></tr>';

            this.tblAuthor.on('click', function(e) {
                var btn = $markup.find(e.target);
                if (btn.hasClass('close') && !btn.hasClass('disabled')) {
                    var el = btn.closest('tr'),
                        idx = me.tblAuthor.find('tr').index(el);
                    el.remove();
                    me.authors.splice(idx, 1);
                    me.coreProps.asc_putCreator(me.authors.join(';'));
                    me.api.asc_setCoreProps(me.coreProps);
                    me.updateScroller(true);
                }
            });

            this.inputAuthor = new Common.UI.InputField({
                el          : $markup.findById('#id-info-add-author'),
                style       : 'width: 200px;',
                validateOnBlur: false,
                placeHolder: this.txtAddAuthor,
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            }).on('changed:after', function(input, newValue, oldValue, e) {
                if (newValue == oldValue) return;

                var val = newValue.trim();
                if (!!val && val !== oldValue.trim()) {
                    var isFromApply = e && e.relatedTarget && (e.relatedTarget.id == 'fminfo-btn-apply');
                    val.split(/\s*[,;]\s*/).forEach(function(item){
                        var str = item.trim();
                        if (str) {
                            me.authors.push(item);
                            if (!isFromApply) {
                                var div = $(Common.Utils.String.format(me.authorTpl, Common.Utils.String.htmlEncode(str)));
                                me.trAuthor.before(div);
                                me.updateScroller();
                            }
                        }
                    });
                    !isFromApply && me.inputAuthor.setValue('');
                }

                me.coreProps.asc_putCreator(me.authors.join(';'));
                me.api.asc_setCoreProps(me.coreProps);
            }).on('keydown:before', keyDownBefore);

            this.rendered = true;

            this.updateInfo(this.doc);

            this.$el = $(node).html($markup);
            if (_.isUndefined(this.scroller)) {
                this.scroller = new Common.UI.Scroller({
                    el: this.$el,
                    alwaysVisibleY: true
                });
            }

            Common.NotificationCenter.on({
                'window:resize': function() {
                    me.isVisible() && me.updateScroller();
                }
            });

            return this;
        },

        show: function() {
            Common.UI.BaseView.prototype.show.call(this,arguments);

            this.updateFileInfo();
            this.scroller && this.scroller.scrollTop(0);
            this.updateScroller();
        },

        hide: function() {
            Common.UI.BaseView.prototype.hide.call(this,arguments);
        },

        updateScroller: function(destroy) {
            if (this.scroller) {
                this.scroller.update(destroy ? {} : undefined);
            }
        },

        updateInfo: function(doc) {
            this.doc = doc;
            if (!this.rendered)
                return;

            var visible = false;
            doc = doc || {};
            if (doc.info) {
                // server info
                if (doc.info.folder )
                    this.lblPlacement.text( doc.info.folder );
                visible = this._ShowHideInfoItem(this.lblPlacement, doc.info.folder!==undefined && doc.info.folder!==null) || visible;
                var value = doc.info.owner;
                if (value)
                    this.lblOwner.text(value);
                visible = this._ShowHideInfoItem(this.lblOwner, !!value) || visible;
                value = doc.info.uploaded;
                if (value)
                    this.lblUploaded.text(value);
                visible = this._ShowHideInfoItem(this.lblUploaded, !!value) || visible;
            } else
                this._ShowHideDocInfo(false);
            $('tr.divider.general', this.el)[visible?'show':'hide']();

            var appname = (this.api) ? this.api.asc_getAppProps() : null;
            if (appname) {
                appname = (appname.asc_getApplication() || '') + (appname.asc_getAppVersion() ? ' ' : '') + (appname.asc_getAppVersion() || '');
                this.lblApplication.text(appname);
            }
            this._ShowHideInfoItem(this.lblApplication, !!appname);

            this.coreProps = (this.api) ? this.api.asc_getCoreProps() : null;
            var value = this.coreProps ? this.coreProps.asc_getCreated() : '';
            this.lblDate.text(this.dateToString(value));
            this._ShowHideInfoItem(this.lblDate, !!value);

            this.renderCustomProperties();
        },

        updateFileInfo: function() {
            if (!this.rendered)
                return;

            var me = this,
                props = (this.api) ? this.api.asc_getCoreProps() : null,
                value;

            this.coreProps = props;
            var visible = false;
            value = props ? props.asc_getModified() : '';
            this.lblModifyDate.text(this.dateToString(value));
            visible = this._ShowHideInfoItem(this.lblModifyDate, !!value) || visible;
            value = props ? props.asc_getLastModifiedBy() : '';
            if (value)
                this.lblModifyBy.text(AscCommon.UserInfoParser.getParsedName(value));
            visible = this._ShowHideInfoItem(this.lblModifyBy, !!value) || visible;
            $('tr.divider.modify', this.el)[visible?'show':'hide']();

            value = props ? props.asc_getTitle() : '';
            this.inputTitle.setValue(value || '');
            value = props ? props.asc_getKeywords() : '';
            this.inputTags.setValue(value || '');
            value = props ? props.asc_getSubject() : '';
            this.inputSubject.setValue(value || '');
            value = props ? props.asc_getDescription() : '';
            this.inputComment.setValue(value || '');

            this.inputAuthor.setValue('');
            this.tblAuthor.find('tr:not(:last-of-type)').remove();
            this.authors = [];
            value = props ? props.asc_getCreator() : '';//"123\"\"\"\<\>,456";
            value && value.split(/\s*[,;]\s*/).forEach(function(item) {
                var div = $(Common.Utils.String.format(me.authorTpl, Common.Utils.String.htmlEncode(item)));
                me.trAuthor.before(div);
                me.authors.push(item);
            });
            this.tblAuthor.find('.close').toggleClass('hidden', !this.mode.isEdit);
            !this.mode.isEdit && this._ShowHideInfoItem(this.tblAuthor, !!this.authors.length);
            this.SetDisabled();
        },

        tplCustomProperty: function(name, type, value) {
            if (type === AscCommon.c_oVariantTypes.vtBool) {
                value = value ? this.txtYes : this.txtNo;
            } else if (type === AscCommon.c_oVariantTypes.vtFiletime) {
                value = this.dateToString(new Date(value), true);
            } else {
                value = Common.Utils.String.htmlEncode(value);
            }

            return '<tr data-custom-property>' +
                '<td class="left"><label>' + Common.Utils.String.htmlEncode(name) + '</label></td>' +
                '<td class="right"><div class="custom-property-wrapper">' +
                '<input type="text" spellcheck="false" class="form-control" readonly style="width: 200px;" value="' + value +'">' +
                '<div class="tool close img-colored" data-hint="2" data-hint-direction="right" data-hint-offset="small"></div>' +
                '</div></td></tr>';
        },

        dateToString: function (value, hideTime) {
            var text = '';
            if (value) {
                var lang = (this.mode.lang || 'en').replace('_', '-').toLowerCase();
                try {
                    if ( lang == 'ar-SA'.toLowerCase() ) lang = lang + '-u-nu-latn-ca-gregory';
                    text = value.toLocaleString(lang, {year: 'numeric', month: '2-digit', day: '2-digit'}) + (!hideTime ? ' ' + value.toLocaleString(lang, {timeStyle: 'short'}) : '');
                } catch (e) {
                    lang = 'en';
                    text = value.toLocaleString(lang, {year: 'numeric', month: '2-digit', day: '2-digit'}) + (!hideTime ? ' ' + value.toLocaleString(lang, {timeStyle: 'short'}) : '');
                }
            }
            return text;
        },

        renderCustomProperties: function() {
            if (!this.api) {
                return;
            }

            $('tr[data-custom-property]').remove();

            var properties = this.api.asc_getAllCustomProperties();
            _.each(properties, _.bind(function(prop, idx) {
                var me = this, name = prop.asc_getName(), type = prop.asc_getType(), value = prop.asc_getValue();
                var $propertyEl = $(this.tplCustomProperty(name, type, value));

                $('tbody.properties-tab').append($propertyEl);

                $propertyEl.on('click', function (e) {
                    if ($propertyEl.find('div.disabled').length) {
                        return;
                    }

                    var btn = $propertyEl.find(e.target);
                    if (btn.hasClass('close')) {
                        // me.api.asc_removeCustomProperty(idx);
                        me.renderCustomProperties();
                    } else if (btn.hasClass('form-control')) {
                        // edit custom props
                    }
                });
            }, this));
        },

        setDisabledCustomProperties: function(disable) {
            _.each($('tr[data-custom-property]'), function(prop) {
                $(prop).find('div.custom-property-wrapper')[disable ? 'addClass' : 'removeClass']('disabled');
                $(prop).find('div.close')[disable ? 'hide' : 'show']();
            })
        },

        _ShowHideInfoItem: function(el, visible) {
            el.closest('tr')[visible?'show':'hide']();
            return visible;
        },

        _ShowHideDocInfo: function(visible) {
            this._ShowHideInfoItem(this.lblPlacement, visible);
            this._ShowHideInfoItem(this.lblOwner, visible);
            this._ShowHideInfoItem(this.lblUploaded, visible);
        },

        setMode: function(mode) {
            this.mode = mode;
            this.inputAuthor.setVisible(mode.isEdit);
            this.tblAuthor.find('.close').toggleClass('hidden', !mode.isEdit);
            if (!mode.isEdit) {
                this.inputTitle._input.attr('placeholder', '');
                this.inputTags._input.attr('placeholder', '');
                this.inputSubject._input.attr('placeholder', '');
                this.inputComment._input.attr('placeholder', '');
                this.inputAuthor._input.attr('placeholder', '');
            }
            this.SetDisabled();
            return this;
        },

        setApi: function(o) {
            this.api = o;
            this.api.asc_registerCallback('asc_onLockCore',  _.bind(this.onLockCore, this));
            this.updateInfo(this.doc);
            return this;
        },

        onLockCore: function(lock) {
            this._locked = lock;
            this.updateFileInfo();
        },

        SetDisabled: function() {
            var disable = !this.mode.isEdit || this._locked;
            this.inputTitle.setDisabled(disable);
            this.inputTags.setDisabled(disable);
            this.inputSubject.setDisabled(disable);
            this.inputComment.setDisabled(disable);
            this.inputAuthor.setDisabled(disable);
            this.tblAuthor.find('.close').toggleClass('disabled', this._locked);
            this.tblAuthor.toggleClass('disabled', disable);
            this.setDisabledCustomProperties(disable);
        },

        txtPlacement: 'Location',
        txtOwner: 'Owner',
        txtUploaded: 'Uploaded',
        txtAppName: 'Application',
        txtTitle: 'Title',
        txtTags: 'Tags',
        txtSubject: 'Subject',
        txtComment: 'Comment',
        txtModifyDate: 'Last Modified',
        txtModifyBy: 'Last Modified By',
        txtCreated: 'Created',
        txtAuthor: 'Author',
        txtAddAuthor: 'Add Author',
        txtAddText: 'Add Text',
        txtMinutes: 'min',
        okButtonText: 'Apply',
        txtVisioInfo: 'Document Info',
        txtCommon: 'Common',
        txtProperties: 'Properties',
        txtDocumentPropertyUpdateTitle: "Document Property",
        txtYes: 'Yes',
        txtNo: 'No'
    }, VE.Views.FileMenuPanels.DocumentInfo || {}));

    VE.Views.FileMenuPanels.DocumentRights = Common.UI.BaseView.extend(_.extend({
        el: '#panel-rights',
        menu: undefined,

        initialize: function(options) {
            Common.UI.BaseView.prototype.initialize.call(this,arguments);
            this.rendered = false;

            this.template = _.template([
                '<div class="header">' + this.txtAccessRights + '</div>',
                '<table class="main">',
                    '<tr class="rights">',
                        '<td class="left" style="vertical-align: top;"><label>' + this.txtRights + '</label></td>',
                        '<td class="right"><div id="id-info-rights"></div></td>',
                    '</tr>',
                    '<tr class="edit-rights">',
                        '<td class="left"></td><td class="right"><button id="id-info-btn-edit" class="btn normal dlg-btn primary auto">' + this.txtBtnAccessRights + '</button></td>',
                    '</tr>',
                '</table>'
            ].join(''));

            this.templateRights = _.template([
                '<table>',
                    '<% _.each(users, function(item) { %>',
                    '<tr>',
                        '<td><span class="userLink img-commonctrl <% if (item.isLink) { %>sharedLink<% } %>"></span><span><%= Common.Utils.String.htmlEncode(item.user) %></span></td>',
                        '<td><%= Common.Utils.String.htmlEncode(item.permissions) %></td>',
                    '</tr>',
                    '<% }); %>',
                '</table>'
            ].join(''));

            this.menu = options.menu;
        },

        render: function(node) {
            var $markup = $(this.template());

            this.cntRights = $markup.findById('#id-info-rights');
            this.btnEditRights = new Common.UI.Button({
                el: $markup.findById('#id-info-btn-edit')
            });
            this.btnEditRights.on('click', _.bind(this.changeAccessRights, this));

            this.rendered = true;

            this.updateInfo(this.doc);

            this.$el = $(node).html($markup);

            if (_.isUndefined(this.scroller)) {
                this.scroller = new Common.UI.Scroller({
                    el: this.$el,
                    suppressScrollX: true,
                    alwaysVisibleY: true
                });
            }

            Common.NotificationCenter.on('collaboration:sharingupdate', this.updateSharingSettings.bind(this));
            Common.NotificationCenter.on('collaboration:sharingdeny', this.onLostEditRights.bind(this));

            return this;
        },

        show: function() {
            Common.UI.BaseView.prototype.show.call(this,arguments);
            this.scroller && this.scroller.update();
        },

        hide: function() {
            Common.UI.BaseView.prototype.hide.call(this,arguments);
        },

        updateInfo: function(doc) {
            this.doc = doc;
            if (!this.rendered)
                return;

            doc = doc || {};

            if (doc.info) {
                if (doc.info.sharingSettings)
                    this.cntRights.html(this.templateRights({users: doc.info.sharingSettings}));
                this._ShowHideInfoItem('rights', doc.info.sharingSettings!==undefined && doc.info.sharingSettings!==null && doc.info.sharingSettings.length>0);
                this._ShowHideInfoItem('edit-rights', (!!this.sharingSettingsUrl && this.sharingSettingsUrl.length || this.mode.canRequestSharingSettings) && this._readonlyRights!==true);
            } else
                this._ShowHideDocInfo(false);
        },

        _ShowHideInfoItem: function(cls, visible) {
            $('tr.'+cls, this.el)[visible?'show':'hide']();
        },

        _ShowHideDocInfo: function(visible) {
            this._ShowHideInfoItem('rights', visible);
            this._ShowHideInfoItem('edit-rights', visible);
        },

        setMode: function(mode) {
            this.mode = mode;
            this.sharingSettingsUrl = mode.sharingSettingsUrl;
            return this;
        },

        changeAccessRights: function(btn,event,opts) {
            Common.NotificationCenter.trigger('collaboration:sharing');
        },

        updateSharingSettings: function(rights) {
            this._ShowHideInfoItem('rights', this.doc.info.sharingSettings!==undefined && this.doc.info.sharingSettings!==null && this.doc.info.sharingSettings.length>0);
            this.cntRights.html(this.templateRights({users: this.doc.info.sharingSettings}));
        },

        onLostEditRights: function() {
            this._readonlyRights = true;
            if (!this.rendered)
                return;

            this._ShowHideInfoItem('edit-rights', false);
        },

        txtRights: 'Persons who have rights',
        txtBtnAccessRights: 'Change access rights',
        txtAccessRights: 'Access Rights'
    }, VE.Views.FileMenuPanels.DocumentRights || {}));

    VE.Views.FileMenuPanels.Help = Common.UI.BaseView.extend({
        el: '#panel-help',
        menu: undefined,

        template: _.template([
            '<div style="width:100%; height:100%; position: relative;">',
                '<div id="id-help-contents" style="position: absolute; width:220px; top: 0; bottom: 0;" class="no-padding"></div>',
                '<div id="id-help-frame" class="no-padding"></div>',
            '</div>'
        ].join('')),

        initialize: function(options) {
            Common.UI.BaseView.prototype.initialize.call(this,arguments);

            this.menu = options.menu;
            this.urlPref = 'resources/help/en/';
            this.openUrl = null;

            this.en_data = [
                {"src": "ProgramInterface/ProgramInterface.htm", "name": "Introducing Visio Editor user interface", "headername": "Program Interface"},
                {"src": "ProgramInterface/FileTab.htm", "name": "File tab"},
                {"src": "UsageInstructions/OpenCreateNew.htm", "name": "Create a new document or open an existing one", "headername": "Basic operations" },
                {"src": "UsageInstructions/ViewVisioInfo.htm", "name": "View document information", "headername": "Tools and settings"},
                {"src": "HelpfulHints/About.htm", "name": "About Visio Editor", "headername": "Helpful hints"},
                {"src": "HelpfulHints/SupportedFormats.htm", "name": "Supported formats of electronic documents"},
                {"src": "HelpfulHints/KeyboardShortcuts.htm", "name": "Keyboard shortcuts"}
            ];

            if (Common.Utils.isIE) {
                window.onhelp = function () { return false; }
            }
        },

        render: function() {
            var me = this;
            this.$el.html(this.template());

            this.viewHelpPicker = new Common.UI.DataView({
                el: $('#id-help-contents'),
                store: new Common.UI.DataViewStore([]),
                keyMoveDirection: 'vertical',
                itemTemplate: _.template([
                    '<div id="<%= id %>" class="help-item-wrap">',
                        '<div class="caption"><%= name %></div>',
                    '</div>'
                ].join(''))
            });
            this.viewHelpPicker.on('item:add', function(dataview, itemview, record) {
                if (record.has('headername')) {
                    $(itemview.el).before('<div class="header-name">' + record.get('headername') + '</div>');
                }
            });

            this.viewHelpPicker.on('item:select', function(dataview, itemview, record) {
                me.onSelectItem(record.get('src'));
            });

            this.iFrame = document.createElement('iframe');

            this.iFrame.src = "";
            this.iFrame.align = "top";
            this.iFrame.frameBorder = "0";
            this.iFrame.width = "100%";
            this.iFrame.height = "100%";
            if (Common.Utils.isChrome || Common.Utils.isOpera || Common.Utils.isGecko && Common.Utils.firefoxVersion>86)
                this.iFrame.onload = function() {
                    try {
                        me.findUrl(me.iFrame.contentWindow.location.href);
                    } catch (e) {
                    }
                };

            Common.Gateway.on('internalcommand', function(data) {
                if (data.type == 'help:hyperlink') {
                    me.findUrl(data.data);
                }
            });
            
            $('#id-help-frame').append(this.iFrame);

            return this;
        },

        setLangConfig: function(lang) {
            var me = this;
            var store = this.viewHelpPicker.store;
            if (lang) {
                lang = lang.split(/[\-\_]/)[0];
                var config = {
                    dataType: 'json',
                    error: function () {
                        if ( me.urlPref.indexOf('resources/help/en/')<0 ) {
                            me.urlPref = 'resources/help/en/';
                            store.url = 'resources/help/en/Contents.json';
                            store.fetch(config);
                        } else {
                            me.urlPref = 'resources/help/en/';
                            store.reset(me.en_data);
                        }
                    },
                    success: function () {
                        var rec = me.openUrl ? store.find(function(record){
                            return (me.openUrl.indexOf(record.get('src'))>=0);
                        }) : store.at(0);
                        if (rec) {
                            me.viewHelpPicker.selectRecord(rec, true);
                            me.viewHelpPicker.scrollToRecord(rec);
                        }
                        me.onSelectItem(me.openUrl ? me.openUrl : rec.get('src'));
                    }
                };

                if ( Common.Controllers.Desktop.isActive() ) {
                    if ( !Common.Controllers.Desktop.isHelpAvailable() ) {
                        me.noHelpContents = true;
                        me.iFrame.src = '../../common/main/resources/help/download.html';
                    } else {
                        me.urlPref = Common.Controllers.Desktop.helpUrl() + '/';
                        store.url = me.urlPref + 'Contents.json';
                        store.fetch(config);
                    }
                } else {
                    store.url = 'resources/help/' + lang + '/Contents.json';
                    store.fetch(config);
                    this.urlPref = 'resources/help/' + lang + '/';
                }
            }
        },

        show: function (url) {
            Common.UI.BaseView.prototype.show.call(this);
            if (!this._scrollerInited) {
                this.viewHelpPicker.scroller.update();
                this._scrollerInited = true;
            }
            if (url) {
                if (this.viewHelpPicker.store.length>0) {
                    this.findUrl(url);
                    this.onSelectItem(url);
                } else
                    this.openUrl = url;
            }
        },

        onSelectItem: function(src) {
            this.iFrame.src = this.urlPref + src;
        },

        findUrl: function(src) {
            var rec = this.viewHelpPicker.store.find(function(record){
                return (src.indexOf(record.get('src'))>=0);
            });
            if (rec) {
                this.viewHelpPicker.selectRecord(rec, true);
                this.viewHelpPicker.scrollToRecord(rec);
            }
        }
    });

    VE.Views.PrintWithPreview = Common.UI.BaseView.extend(_.extend({
        el: '#panel-print',
        menu: undefined,

        template: _.template([
            '<div style="width:100%; height:100%; position: relative;">',
                '<div id="id-print-settings" class="no-padding">',
                    '<div class="print-settings">',
                        '<div class="flex-settings ps-container oo settings-container">',
                            '<div class="main-header"><%= scope.txtPrint %></div>',
                            '<table style="width: 100%;">',
                                '<tbody>',
                                    '<tr><td><label class="font-weight-bold"><%= scope.txtPrinter %></label></td></tr>',
                                    '<tr><td class="padding-large"><div id="print-combo-printer" style="width: 248px;"></div></td></tr>',
                                    '<tr><td><label class="font-weight-bold"><%= scope.txtColorPrinting %></label></td></tr>',
                                    '<tr><td class="padding-large"><div id="print-combo-color-printing" style="width: 248px;"></div></td></tr>',
                                    '<tr><td><label class="font-weight-bold"><%= scope.txtPrintRange %></label></td></tr>',
                                    '<tr><td class="padding-large"><div id="print-combo-range" style="width: 248px;"></div></td></tr>',
                                    '<tr><td class="padding-large">',
                                        '<table style="width: 100%;"><tbody>',
                                        '<tr><td class="padding-large"><%= scope.txtPages %>:</td><td class="padding-large" style="width: 100%;"><div id="print-txt-pages" class="padding-left-5" style="width: 100%;"></div></td></tr>',
                                        '<tr><td><%= scope.txtCopies %>:</td><td style="width: 100%;"><div id="print-txt-copies" class="padding-left-5" style="width: 60px;"></div></td></tr>',
                                        '</tr></tbody></table>',
                                    '</td></tr>',
                                    '<tr><td><label class="font-weight-bold"><%= scope.txtPrintSides %></label></td></tr>',
                                    '<tr><td class="padding-large"><div id="print-combo-sides" style="width: 248px;"></div></td></tr>',
                                    '<tr><td><label class="font-weight-bold"><%= scope.txtPaperSize %></label></td></tr>',
                                    '<tr><td class="padding-large"><div id="print-combo-pages" style="width: 248px;"></div></td></tr>',
                                    '<tr><td class="padding-large"><label id="print-btn-system-dialog" data-hint="2" data-hint-direction="bottom" data-hint-offset="medium"><span class="link"><%= scope.txtPrintUsingSystemDialog %></span></label></td></tr>',
                                    '<tr class="fms-btn-apply"><td>',
                                        '<div class="footer justify">',
                                            '<button id="print-btn-print" class="btn normal dlg-btn primary margin-right-8" result="print" style="width: 96px;" data-hint="2" data-hint-direction="bottom" data-hint-offset="big"><%= scope.txtPrint %></button>',
                                            '<button id="print-btn-print-pdf" class="btn normal dlg-btn" result="pdf" style="min-width: 96px;width: auto;" data-hint="2" data-hint-direction="bottom" data-hint-offset="big"><%= scope.txtPrintPdf %></button>',
                                        '</div>',
                                    '</td></tr>',
                                '</tbody>',
                            '</table>',
                        '</div>',
                    '</div>',
                '</div>',
                '<div id="print-preview-box" class="no-padding">',
                    '<div id="print-preview"></div>',
                    '<div id="print-navigation">',
                        '<% if (!isRTL) { %>',
                            '<div id="print-prev-page"></div>',
                            '<div id="print-next-page"></div>',
                        '<% } else { %>',
                            '<div id="print-next-page"></div>',
                            '<div id="print-prev-page"></div>',
                        '<% } %>',
                        '<div class="page-number margin-left-10">',
                            '<label><%= scope.txtPage %></label>',
                            '<div id="print-number-page" class="margin-left-4"></div>',
                            '<label id="print-count-page" class="margin-left-4"><%= scope.txtOf %></label>',
                        '</div>',
                    '</div>',
                '</div>',
                '<div id="print-preview-empty" class="hidden">',
                    '<div><%= scope.txtEmptyTable %></div>',
                '</div>',
            '</div>'
        ].join('')),

        initialize: function(options) {
            Common.UI.BaseView.prototype.initialize.call(this,arguments);

            this.menu = options.menu;

            this._defaultPaperSizeList = [
                { value: 0, displayValue: ['US Letter', '21,59', '27,94', 'cm'], caption: 'US Letter', size: [215.9, 279.4]},
                { value: 1, displayValue: ['US Legal', '21,59', '35,56', 'cm'], caption: 'US Legal', size: [215.9, 355.6]},
                { value: 2, displayValue: ['A4', '21', '29,7', 'cm'], caption: 'A4', size: [210, 297]},
                { value: 3, displayValue: ['A5', '14,8', '21', 'cm'], caption: 'A5', size: [148, 210]},
                { value: 4, displayValue: ['B5', '17,6', '25', 'cm'], caption: 'B5', size: [176, 250]},
                { value: 5, displayValue: ['Envelope #10', '10,48', '24,13', 'cm'], caption: 'Envelope #10', size: [104.8, 241.3]},
                { value: 6, displayValue: ['Envelope DL', '11', '22', 'cm'], caption: 'Envelope DL', size: [110, 220]},
                { value: 7, displayValue: ['Tabloid', '27,94', '43,18', 'cm'], caption: 'Tabloid', size: [279.4, 431.8]},
                { value: 8, displayValue: ['A3', '29,7', '42', 'cm'], caption: 'A3', size: [297, 420]},
                { value: 9, displayValue: ['Tabloid Oversize', '29,69', '45,72', 'cm'], caption: 'Tabloid Oversize', size: [296.9, 457.2]},
                { value: 10, displayValue: ['ROC 16K', '19,68', '27,3', 'cm'], caption: 'ROC 16K', size: [196.8, 273]},
                { value: 11, displayValue: ['Envelope Choukei 3', '12', '23,5', 'cm'], caption: 'Envelope Choukei 3', size: [120, 235]},
                { value: 12, displayValue: ['Super B/A3', '30,5', '48,7', 'cm'], caption: 'Super B/A3', size: [305, 487]},
                { value: 13, displayValue: ['A4', '84,1', '118,9', 'cm'], caption: 'A0', size: [841, 1189]},
                { value: 14, displayValue: ['A4', '59,4', '84,1', 'cm'], caption: 'A1', size: [594, 841]},
                { value: 16, displayValue: ['A4', '42', '59,4', 'cm'], caption: 'A2', size: [420, 594]},
                { value: 17, displayValue: ['A4', '10,5', '14,8', 'cm'], caption: 'A6', size: [105, 148]}
            ];

            this._initSettings = true;
            this._originalPageSize = undefined;
            this._colorPrinting = '';
        },

        render: function(node) {
            var me = this;

            var $markup = $(this.template({scope: this, isRTL: Common.UI.isRTL()}));

            this.cmbPrinter = new Common.UI.ComboBox({
                el: $markup.findById('#print-combo-printer'),
                menuStyle: 'width: 248px;max-height: 280px;',
                editable: false,
                takeFocusOnClose: true,
                restoreMenuHeightAndTop: true,
                cls: 'input-group-nr',
                placeHolder: this.txtPrinterNotSelected,
                itemsTemplate:  _.template([
                    '<% if (items.length > 0) { %>',
                        '<% _.each(items, function(item) { %>',
                            '<li id="<%= item.id %>" data-value="<%= item.value %>"><a tabindex="-1" type="menuitem" <% if (typeof(item.checked) !== "undefined" && item.checked) { %> class="checked" <% } %> ><%= scope.getDisplayValue(item) %></a></li>',
                        '<% }); %>',
                    '<% } %>',
                    '<% if(scope.options.isWatingForPrinters) { %>',
                        '<li><a id="print-waiting-for-printers" class="text-dropdown-item" onclick="event.stopPropagation();">' + this.txtWaitingForPrinters + '<div class="spiner-image"></div></a></li>',
                    '<% } else if(items.length == 0) {%>',
                        '<li><a class="text-dropdown-item" onclick="event.stopPropagation();">' + this.txtPrintersNotFound + '</a></li>',
                    '<% } %>'
                ].join('')),
                isWatingForPrinters: true,
                data: [],
                dataHint: '2',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big'
            });
            this.cmbPrinter.on('selected', _.bind(this.onPrinterSelected, this));

            this.cmbColorPrinting = new Common.UI.ComboBox({
                el: $markup.findById('#print-combo-color-printing'),
                menuStyle: 'width: 248px; max-height: 280px;',
                editable: false,
                takeFocusOnClose: true,
                restoreMenuHeightAndTop: true,
                cls: 'input-group-nr',
                disabled: true,
                data: [
                    { value: 'color', displayValue: this.txtColorPrinting },
                    { value: 'black-and-white', displayValue: this.txtBlackAndWhitePrinting }
                ],
                dataHint: '2',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big'
            });
            this.cmbColorPrinting.on('selected', _.bind(function(combo, record) { 
                this._colorPrinting = record.value 
            }, this));
            this.cmbColorPrinting.setValue('black-and-white');
            this._colorPrinting = 'black-and-white';

            this.cmbRange = new Common.UI.ComboBox({
                el: $markup.findById('#print-combo-range'),
                menuStyle: 'min-width: 248px;max-height: 280px;',
                editable: false,
                takeFocusOnClose: true,
                restoreMenuHeightAndTop: true,
                cls: 'input-group-nr',
                data: [
                    { value: 'all', displayValue: this.txtAllPages },
                    { value: 'current', displayValue: this.txtCurrentPage },
                    { value: -1, displayValue: this.txtCustomPages }
                ],
                dataHint: '2',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big'
            });
            this.cmbRange.setValue('all');

            this.inputPages = new Common.UI.InputField({
                el: $markup.findById('#print-txt-pages'),
                allowBlank: true,
                validateOnChange: true,
                validateOnBlur: false,
                maskExp: /[0-9,\-]/,
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            });

            this.spnCopies = new Common.UI.MetricSpinner({
                el: $markup.findById('#print-txt-copies'),
                step: 1,
                width: 60,
                defaultUnit : '',
                value: 1,
                maxValue: 32767,
                minValue: 1,
                allowDecimal: false,
                maskExp: /[0-9]/,
                dataHint: '2',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big'
            });

            this.cmbSides = new Common.UI.ComboBox({
                el          : $markup.findById('#print-combo-sides'),
                menuStyle   : 'width:100%;',
                editable: false,
                takeFocusOnClose: true,
                restoreMenuHeightAndTop: true,
                cls         : 'input-group-nr',
                data        : [
                    { value: 'one', displayValue: this.txtOneSide, descValue: this.txtOneSideDesc },
                    { value: 'both-long', displayValue: this.txtBothSides, descValue: this.txtBothSidesLongDesc },
                    { value: 'both-short', displayValue: this.txtBothSides, descValue: this.txtBothSidesShortDesc }
                ],
                itemsTemplate: _.template([
                    '<% _.each(items, function(item) { %>',
                    '<li id="<%= item.id %>" data-value="<%- item.value %>"><a tabindex="-1" type="menuitem" style ="display: flex; flex-direction: column;">',
                    '<label class="font-weight-bold"><%= scope.getDisplayValue(item) %></label><label class="comment-text"><%= item.descValue %></label></a></li>',
                    '<% }); %>'
                ].join('')),
                dataHint: '2',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big'
            });
            this.cmbSides.setValue('one');

            var paperSizeItemsTemplate = !Common.UI.isRTL() ?
                _.template([
                    '<% _.each(items, function(item) { %>',
                    '<li id="<%= item.id %>" data-value="<%- item.value %>"><a tabindex="-1" type="menuitem">',
                    '<%= item.displayValue[0] %>',
                    ' (<%= item.displayValue[1] %> <%= item.displayValue[3] %> x',
                    ' <%= item.displayValue[2] %> <%= item.displayValue[3] %>)',
                    '</a></li>',
                    '<% }); %>'
                ].join('')) :
                _.template([
                    '<% _.each(items, function(item) { %>',
                    '<li id="<%= item.id %>" data-value="<%- item.value %>"><a tabindex="-1" type="menuitem" dir="ltr">',
                    '(<span dir="rtl"><%= item.displayValue[2] %> <%= item.displayValue[3] %></span>',
                    '<span> x </span>',
                    '<span dir="rtl"><%= item.displayValue[1] %> <%= item.displayValue[3] %></span>)',
                    '<span> <%= item.displayValue[0] %></span>',
                    '</a></li>',
                    '<% }); %>'
                ].join(''));

            var paperSizeTemplate = _.template([
                '<div class="input-group combobox input-group-nr <%= cls %>" id="<%= id %>" style="<%= style %>">',
                '<div class="form-control" style="padding-top:3px; line-height: 14px; cursor: pointer; width: 248px; <%= style %>"',
                (Common.UI.isRTL() ? 'dir="rtl"' : ''), '></div>',
                '<div style="display: table-cell;"></div>',
                '<button type="button" class="btn btn-default dropdown-toggle" data-toggle="dropdown"><span class="caret"></span></button>',
                '<ul class="dropdown-menu <%= menuCls %>" style="<%= menuStyle %>" role="menu">'].concat(paperSizeItemsTemplate).concat([
                '</ul>',
                '</div>'
            ]).join(''));

            this.cmbPaperSize = new Common.UI.ComboBoxCustom({
                el: $markup.findById('#print-combo-pages'),
                menuStyle: 'max-height: 280px; width: 248px;',
                editable: false,
                takeFocusOnClose: true,
                restoreMenuHeightAndTop: true,
                template: paperSizeTemplate,
                itemsTemplate: paperSizeItemsTemplate,
                data: [].concat(this._defaultPaperSizeList),
                dataHint: '2',
                dataHintDirection: 'bottom',
                dataHintOffset: 'big',
                updateFormControl: function (record, customValue){
                    var formcontrol = $(this.el).find('.form-control');
                    if (record || customValue) {
                        var displayValue = customValue ? customValue : record.get('displayValue');
                        if (typeof displayValue === 'string') {
                            formcontrol[0].innerHTML = displayValue;
                        } else {
                            if (!Common.UI.isRTL()) {
                                formcontrol[0].innerHTML = displayValue[0] + ' (' + displayValue[1] + ' ' + displayValue[3] + ' x ' +
                                    displayValue[2] + ' ' + displayValue[3] + ')';
                            } else {
                                formcontrol[0].innerHTML = '<span dir="ltr">(<span dir="rtl">' + displayValue[2] + ' ' + displayValue[3] + '</span>' +
                                    '<span> x </span>' + '<span dir="rtl">' + displayValue[1] + ' ' + displayValue[3] + '</span>)' +
                                    '<span> ' + displayValue[0] + '</span></span>';
                            }
                        }
                    } else
                        formcontrol[0].innerHTML = '';
                }
            });
            this.cmbPaperSize.setValue(2);

            this.pnlSettings = $markup.find('.flex-settings').addBack().filter('.flex-settings');
            this.pnlTable = $(this.pnlSettings.find('table')[0]);
            this.trApply = $markup.find('.fms-btn-apply');

            this.btnPrintSystemDialog = $markup.find('#print-btn-system-dialog > span');
            this.btnPrint = new Common.UI.Button({
                el: $markup.findById('#print-btn-print'),
                disabled: true
            });
            this.btnPrintPdf = new Common.UI.Button({
                el: $markup.findById('#print-btn-print-pdf')
            });

            this.btnPrevPage = new Common.UI.Button({
                parentEl: $markup.findById('#print-prev-page'),
                cls: 'btn-prev-page',
                iconCls: 'arrow',
                scaling: false,
                dataHint: '2',
                dataHintDirection: 'top'
            });

            this.btnNextPage = new Common.UI.Button({
                parentEl: $markup.findById('#print-next-page'),
                cls: 'btn-next-page',
                iconCls: 'arrow',
                scaling: false,
                dataHint: '2',
                dataHintDirection: 'top'
            });

            this.countOfPages = $markup.findById('#print-count-page');

            this.txtNumberPage = new Common.UI.InputField({
                el: $markup.findById('#print-number-page'),
                allowBlank: true,
                validateOnChange: true,
                style: 'width: 50px;',
                maskExp: /[0-9]/,
                validation: function(value) {
                    if (/(^[0-9]+$)/.test(value)) {
                        value = parseInt(value);
                        if (undefined !== value && value > 0 && value <= me.pageCount)
                            return true;
                    }

                    return me.txtPageNumInvalid;
                },
                dataHint: '2',
                dataHintDirection: 'left',
                dataHintOffset: 'small'
            });

            this.$el = $(node).html($markup);
            this.$previewBox = $('#print-preview-box');
            this.$previewEmpty = $('#print-preview-empty');

            this.applyMode();

            if (_.isUndefined(this.scroller)) {
                this.scroller = new Common.UI.Scroller({
                    el: this.pnlSettings,
                    suppressScrollX: true,
                    alwaysVisibleY: true
                });
            }

            Common.NotificationCenter.on({
                'window:resize': function() {
                    me.isVisible() && me.updateScroller();
                }
            });

            this.updateMetricUnit();

            this.fireEvent('render:after', this);

            return this;
        },

        show: function() {
            Common.UI.BaseView.prototype.show.call(this,arguments);
            if (this._initSettings) {
                this.updateMetricUnit();
                this._initSettings = false;
            }
            this.updateScroller();
            this.fireEvent('show', this);
        },

        updateCmbPrinter: function(currentPrinter, printers, isWaitingForPrinters) {
            const cmbPrinterOptions = (printers || []).map(function(printer) {
                return {
                    value: printer.name,
                    displayValue: printer.name,
                    paperSupported: printer.paper_supported,
                    isDuplexSupported: printer.duplex_supported,
                    colorSupported: !!printer.color_supported
                }
            });

            this.cmbPrinter.options.isWatingForPrinters = isWaitingForPrinters;
            this.cmbPrinter.setData(cmbPrinterOptions);

            let selectedPrinter = this.cmbPrinter.getValue();
            if(!selectedPrinter &&  _.some(cmbPrinterOptions, function(option) { return option.value == currentPrinter })) {
                selectedPrinter = currentPrinter;
            }

            if(selectedPrinter) {
                const isChanged = selectedPrinter != this.cmbPrinter.getValue();
                this.cmbPrinter.setValue(selectedPrinter);
                if(isChanged) {
                    this.cmbPrinter.trigger('selected', this, this.cmbPrinter.getSelectedRecord());
                }
            }
        },

        setCmbColorPrintingDisabled: function(disabled) {
            if(disabled) {
                this.cmbColorPrinting.setValue('black-and-white');
            } else {
                this.cmbColorPrinting.setValue(this._colorPrinting);
            }
            this.cmbColorPrinting.setDisabled(disabled);
        },

        setCmbSidesOptions: function(isDuplexSupported) {
            var cmbValue = this.cmbSides.getValue();
            var list = [{ value: 'one', displayValue: this.txtOneSide, descValue: this.txtOneSideDesc }];
            if(isDuplexSupported) {
                list.push(
                    { value: 'both-long', displayValue: this.txtBothSides, descValue: this.txtBothSidesLongDesc },
                    { value: 'both-short', displayValue: this.txtBothSides, descValue: this.txtBothSidesShortDesc }
                );
            } else if(cmbValue != 'one') {
                cmbValue = 'one';
            }
            this.cmbSides.setData(list);
            this.cmbSides.setValue(cmbValue);
        },

        setCmbPaperSizeOptions: function(paperSizeList) {
            var resultList = [];

            if(paperSizeList && paperSizeList.length > 0) {
                resultList = paperSizeList.map(function(item, index) {
                    return {
                        value: index, 
                        displayValue: [item.name, item.width / 10, item.height / 10, 'cm'], 
                        caption: item.name, 
                        size: [item.width, item.height]
                    }
                });
            } else {
                resultList = [].concat(this._defaultPaperSizeList);
            }

            var prevSelectedOption = this.cmbPaperSize.store.findWhere({ 
                value: this.cmbPaperSize.getValue()
            });
            var newSelectedOption = null;

            function findOptionBySize(list, width, height) {
                return _.find(list, function(option) {
                    return Math.abs(option.size[0] - width) < 0.1 && Math.abs(option.size[1] - height) < 0.1;
                });
            }

            // If a previously selected option exists, search for a matching one in resultList
            if (prevSelectedOption) {
                newSelectedOption = findOptionBySize(
                    resultList, 
                    Math.round(prevSelectedOption.get('size')[0]), 
                    Math.round(prevSelectedOption.get('size')[1])
                );
            }

            if (!newSelectedOption) {
                if(prevSelectedOption) {
                    newSelectedOption = {
                        custom: true,
                        value: [
                            this.txtCustom,
                            parseFloat(Common.Utils.Metric.fnRecalcFromMM(prevSelectedOption.get('size')[0]).toFixed(2)),
                            parseFloat(Common.Utils.Metric.fnRecalcFromMM(prevSelectedOption.get('size')[1]).toFixed(2)),
                            Common.Utils.Metric.getCurrentMetricName()
                        ]
                    }
                } else {
                    const _w = this._originalPageSize ? this._originalPageSize.w : 210,
                        _h = this._originalPageSize ? this._originalPageSize.h : 297;
                    // If no matching option is found, look for the default size 210x297 (A4)
                    if (!newSelectedOption) {
                        newSelectedOption = findOptionBySize(resultList, _w, _h);
                    }

                    if (!newSelectedOption) {
                        newSelectedOption = {
                            custom: true,
                            value: [
                                this.txtCustom,
                                parseFloat(Common.Utils.Metric.fnRecalcFromMM(_w).toFixed(2)),
                                parseFloat(Common.Utils.Metric.fnRecalcFromMM(_h).toFixed(2)),
                                Common.Utils.Metric.getCurrentMetricName()
                            ]
                        };
                    }

                    if (!newSelectedOption && resultList[0]) {
                        newSelectedOption = resultList[0];
                    } 
                }
            }
            
            this.cmbPaperSize.setData(resultList);
            this.updatePaperSizeMetricUnit();
            if (!newSelectedOption) {
                this.cmbPaperSize.setValue(null);
            } else if (newSelectedOption.custom) {
                this.cmbPaperSize.setValue(undefined, newSelectedOption.value);
            } else {
                this.cmbPaperSize.setValue(newSelectedOption.value);
            }
        },

        updateScroller: function() {
            if (this.scroller) {
                Common.UI.Menu.Manager.hideAll();
                var scrolled = this.$el.height()< this.pnlTable.height() + 25 + this.$el.find('.main-header').outerHeight(true);
                this.pnlSettings.css('overflow', scrolled ? 'hidden' : 'visible');
                this.scroller.update();
            }
        },

        setMode: function(mode) {
            this.mode = mode;
            !this._initSettings && this.applyMode();
        },

        applyMode: function() {
            if (!this.mode || !this.$el) return;
            this.$el.find('.header-settings')[this.mode.isEdit ? 'show' : 'hide']();
            // !this.mode.isDesktopApp && this.$el.find('.desktop-settings').hide();
        },

        setApi: function(api) {

        },

        isVisible: function() {
            return (this.$el || $(this.el)).is(":visible");
        },

        setRange: function(value) {
            this.cmbRange.setValue(value);
        },

        getRange: function() {
            return this.cmbRange.getValue();
        },

        updateCountOfPages: function (count) {
            this.countOfPages.text(
                Common.Utils.String.format(this.txtOf, count)
            );
            this.pageCount = count;
        },

        updateCurrentPage: function (index) {
            this.txtNumberPage.setValue(index + 1);
        },

        onPrinterSelected: function(combo, record) {
            this.setCmbSidesOptions(record ? record.isDuplexSupported : true);
            this.setCmbPaperSizeOptions(record ? record.paperSupported : null);
            this.setCmbColorPrintingDisabled(record ? !record.colorSupported : true);
            this.btnPrint.setDisabled(!record);
        },

        updateMetricUnit: function() {
            this.updatePaperSizeMetricUnit();
        },

        updatePaperSizeMetricUnit: function() {
            if (!this.cmbPaperSize) return;
            var store = this.cmbPaperSize.store;
            for (var i=0; i<store.length; i++) {
                var item = store.at(i),
                    size = item.get('size'),
                    pagewidth = size[0],
                    pageheight = size[1];

                item.set('displayValue', [item.get('caption'),
                    parseFloat(Common.Utils.Metric.fnRecalcFromMM(pagewidth).toFixed(2)),
                    parseFloat(Common.Utils.Metric.fnRecalcFromMM(pageheight).toFixed(2)),
                    Common.Utils.Metric.getCurrentMetricName()]);
            }
            this.cmbPaperSize.onResetItems();
        },


        setOriginalPageSize: function (w, h) {
            this._originalPageSize = {w: w, h: h};
        },

        txtPrint: 'Print',
        txtPrintPdf: 'Print to PDF',
        txtPrinter: 'Printer',
        txtPrinterNotSelected: 'Printer not selected',
        txtPrintersNotFound: 'Printers not found',
        txtWaitingForPrinters: 'Waiting for printers',
        txtColorPrinting: 'Color printing',
        txtBlackAndWhitePrinting: 'Black and white printing',
        txtPrintUsingSystemDialog: 'Print using the system dialog',
        txtPrintRange: 'Print range',
        txtCurrentPage: 'Current page',
        txtAllPages: 'All pages',
        txtCustom: 'Custom',
        txtCustomPages: 'Custom print',
        txtPage: 'Page',
        txtOf: 'of {0}',
        txtPageNumInvalid: 'Page number invalid',
        txtEmptyTable: 'There is nothing to print because the presentation is empty',
        txtPages: 'Pages',
        txtPaperSize: 'Paper size',
        txtCopies: 'Copies',
        txtPrintSides: 'Print sides',
        txtOneSide: 'Print one sided',
        txtOneSideDesc: 'Only print on one side of the page',
        txtBothSides: 'Print on both sides',
        txtBothSidesLongDesc: 'Flip pages on long edge',
        txtBothSidesShortDesc: 'Flip pages on short edge'

    }, VE.Views.PrintWithPreview || {}));
});

/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

define('visioeditor/main/app/view/DocumentHolderExt',[], function () {
    'use strict';

    if (window.VE && window.VE.Views && window.VE.Views.DocumentHolder) {
        let dh = window.VE.Views.DocumentHolder.prototype;

        dh.createDelayedElementsViewer = function() {
            var me = this;

            if (me.menuViewCopy) return; // menu is already inited

            me.menuViewCopy = new Common.UI.MenuItem({
                iconCls: 'menu__icon btn-copy',
                caption: me.textCopy,
                value: 'copy'
            });

            this.viewModeMenu = new Common.UI.Menu({
                cls: 'shifted-right',
                initMenu: function (value) {
                    me.menuViewCopy.setDisabled(!(me.api && me.api.can_CopyCut()));
                },
                items: [
                    me.menuViewCopy
                ]
            }).on('hide:after', function (menu, e, isFromInputControl) {
                me.clearCustomItems(menu);
                me.currentMenu = null;
                if (me.suppressEditComplete) {
                    me.suppressEditComplete = false;
                    return;
                }

                if (!isFromInputControl) me.fireEvent('editcomplete', me);
            });

            this.fireEvent('createdelayedelements', [this, 'view']);
        };

        dh.createDelayedElementsEditor = function() {
            var me = this;

            if (me.menuEditCopy) return; // menu is already inited

            me.menuEditCopy = new Common.UI.MenuItem({
                iconCls: 'menu__icon btn-copy',
                caption: me.textCopy,
                value: 'copy'
            });

            this.editModeMenu = new Common.UI.Menu({
                cls: 'shifted-right',
                initMenu: function (value) {
                    me.menuEditCopy.setDisabled(!(me.api && me.api.can_CopyCut()));
                },
                items: [
                    me.menuEditCopy
                ]
            }).on('hide:after', function (menu, e, isFromInputControl) {
                me.clearCustomItems(menu);
                me.currentMenu = null;
                if (me.suppressEditComplete) {
                    me.suppressEditComplete = false;
                    return;
                }

                if (!isFromInputControl) me.fireEvent('editcomplete', me);
            });

            this.fireEvent('createdelayedelements', [this, 'edit']);
        };
    }
});
/*
 * Copyright (C) Ascensio System SIA, 2009-2026
 *
 * This program is a free software product. You can redistribute it and/or
 * modify it under the terms of the GNU Affero General Public License (AGPL)
 * version 3 as published by the Free Software Foundation, together with the
 * additional terms provided in the LICENSE file.
 *
 * This program is distributed WITHOUT ANY WARRANTY; without even the implied
 * warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. For
 * details, see the GNU AGPL at: https://www.gnu.org/licenses/agpl-3.0.html
 *
 * You can contact Ascensio System SIA by email at info@onlyoffice.com
 * or by postal mail at 20A-6 Ernesta Birznieka-Upisha Street, Riga,
 * LV-1050, Latvia, European Union.
 *
 * The interactive user interfaces in modified versions of the Program
 * are required to display Appropriate Legal Notices in accordance with
 * Section 5 of the GNU AGPL version 3.
 *
 * No trademark rights are granted under this License.
 *
 * All non-code elements of the Product, including illustrations,
 * icon sets, and technical writing content, are licensed under the
 * Creative Commons Attribution-ShareAlike 4.0 International License:
 * https://creativecommons.org/licenses/by-sa/4.0/legalcode
 *
 * This license applies only to such non-code elements and does not
 * modify or replace the licensing terms applicable to the Program's
 * source code, which remains licensed under the GNU Affero General
 * Public License v3.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */

require([
    'common/main/lib/controller/ScreenReaderFocus',
    'common/main/lib/view/AdvancedSettingsWindow',
    'common/main/lib/view/DocumentAccessDialog',
    'common/main/lib/view/SaveAsDlg',
    'common/main/lib/view/CopyWarningDialog',
    'common/main/lib/view/SelectFileDlg',
    // 'common/main/lib/view/SearchDialog',
    'common/main/lib/view/RenameDialog',
    'common/main/lib/view/PluginDlg',
    'common/main/lib/view/PluginPanel',
    'common/main/lib/view/TextInputDialog',
    'common/main/lib/view/DocumentHolderExt',
    'common/main/lib/view/CustomizeQuickAccessDialog',
    // 'common/main/lib/view/ShortcutsDialog',
    // 'common/main/lib/view/ShortcutsEditDialog',

    'visioeditor/main/app/view/FileMenuPanels',
    'visioeditor/main/app/view/DocumentHolderExt'
], function () {
    Common.NotificationCenter.trigger('app-pack:loaded');
});

define("../apps/visioeditor/main/app_pack.js", function(){});


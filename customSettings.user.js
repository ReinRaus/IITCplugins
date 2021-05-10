// ==UserScript==
// @id             iitc-plugin-customsettings@jonatkins
// @name           IITC plugin: Custom Settings
// @author         ReinRaus
// @version        1.0.1
// @category       Controls
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://github.com/ReinRaus/IITCplugins/raw/main/customSettings.user.js
// @downloadURL    https://github.com/ReinRaus/IITCplugins/raw/main/customSettings.user.js
// @description    This is API for easy create and manage custom settings in plugins
// @include        https://intel.ingress.com/*
// @include        http://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @match          http://intel.ingress.com/*
// ==/UserScript==

/*global
L, map, $
*/

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};
plugin_info.pluginId = 'customSettings';
plugin_info.title = {
    en: 'Global settings',
    ru: 'Глобальные настройки'
};
plugin_info.description = {
    en: 'Customize settings window',
    ru: 'Персонализируйте вид окна настроек'
};
window.plugin[ plugin_info.pluginId ] = {};
let plugin = window.plugin[ plugin_info.pluginId ];
// здесь хранятся геттеры/сеттеры всех экземпляров USettings
plugin.allSettings = {};
// все созданные экземпляры USettings
plugin.allUnits = {};
// save local storage
plugin.saveStorage = function() {
    localStorage[ plugin_info.pluginId ] = JSON.stringify( plugin.storage );
};
// load local storage
try {
    plugin.storage = JSON.parse( localStorage[ plugin_info.pluginId ] );
} catch(e) {
    plugin.storage = {};
    plugin.saveStorage();
};
// массив с предпочтительным языком сообщений по приоритету: из настроек плагина, из браузера, английский
plugin.locales = [];
let localeFromSettings = plugin.storage?.[ plugin_info.pluginId ]?.language;
if ( localeFromSettings ) plugin.locales.push( localeFromSettings );
plugin.locales = plugin.locales.concat( navigator.languages, "en" );
// проверка что значение css нормально парсится браузером
plugin.validateCssValue = function( value, rule, trustedValue, nodeType = 'div' ) { // ( "#000000", "color", "red" ) or ( "12pixels", "width", "1px" )
    if ( value == trustedValue ) return true;
    let tmp = document.createElement( nodeType );
    tmp.style[ rule ] = trustedValue;
    tmp.style[ rule ] = value;
    return tmp.style[ rule ] !== trustedValue;
};
// преобразование в HTML сущности
plugin.escapeHTML = function( html ) {
    let escape = document.createElement( 'textarea' );
    escape.textContent = html;
    return escape.innerHTML;
}
// узел DOM со страницей настроек
plugin.container = document.createElement( "DIV" );
plugin.container.className = "usettings-box";
plugin.container.innerHTML = `<DIV class="usettings-container"></DIV>`;
plugin.container.addEventListener( "click", function( ev ) {
    ev.stopPropagation(); // отключаем, чтобы событие не попадало на карту
    if ( ev.target == plugin.container ) plugin.container.style.display = "none";
} );
// устанавливаем новый язык страницы настроек, что-то может не поменяться, но это лучше, чем ничего
plugin.replaceLanguage = function() {
    for ( let i in plugin.allUnits ) {
        plugin.allUnits[i].renderAll();
    };
};
// внедрение CSS на страницу
plugin.injectCSS = function (str) {
    var node = document.createElement('style');
    node.innerHTML = str;
    document.body.appendChild(node);
};
// PLUGIN START ////////////////////////////////////////////////////////
// use own namespace for plugin
/*
------------ИНИЦИАЛИЗАЦИЯ НАСТРОЕК-----------------

pluginInfo       - Object, содержит информацию о плагине, который инициирует настройки:
  pluginId       - String, уникальное имя плагина, не должно совпадать с другими плагинами
  title          - String|Object, краткое наименование плагина, многоязычное значение
  description    - String|Object, подробное описание плагина, многоязычное значение

settingsInfo     - Object, содержит информацию о настройках, которые будут использованы в плагине
  [property]     - Object, имя поля объекта settingsInfo - это имя настройки, несколько полей - несколько настроек
    title        - String|Object, краткое наименование настройки, многоязычное значение
    description  - String|Object, подробное описание настройки, многоязычное значение
    default      - String|Number|Boolean required, обязательно необходимо указать значение по-умолчанию
    type         - String, служит для указания стандартного типа настройки
                   "string"   - String, строка, format=string
                   "list"     - String, список предопределенных значений, format=string
                   "combobox" - String, список в котором пользователь может ввести своё значение, format=string
                   "counter"  - Number, число от до, format=integer(from,to)
                   "checkbox" - Boolean, галочка, format=boolean
    from         - Number, для counter - задает минимальное значение
    to           - Number, для counter - задает максимальное значение
    step         - Number, для counter - задает шаг изменения при нажатии на кнопки + -
    format       - function(value)|String|RegExp, функция, которая вызывается каждый раз перед сохранением значения настройки и служит для валидации и приведения значения
                   настройки к требуемому типу данных. Если эта функция ничего не вернула ( return; ), то значение считается некорректным, оно не будет сохранено, а функция
                   render должна показать пользователю, что введенное значение не корректно.
                   Если format - RegExp, то к значению настройки будет применена функция RegExp.test и по её результатам возвращено значение
                   Если format - строка, то можно указать следующие значения:
                   string - произвольная строка, string(x) - строка длиной х символов, string(x,y) - строка длиной от х до у символов, будет приведено toString()
                   integer - произвольное целое число, integer(x,y) - число от х до у, будет приведено parseInt()
                   float - произвольное число с плавающей точкой, float(x,y) - от х до у, будет приведено parseFloat()
                   boolean - булево значение, будет приведено к Boolean()
                   css(rule,trustedValue[,nodeType]) - проверка свойства css на валидность. Нужно указать гарантированно верное значение trustedValue и если свойство rule
                       не применимо к div, то указать умя узла к которому это свойство применимо. Например: css(backgroundColor,red) или css(href,?,a),
                   Если format не указан, то значение считается произвольной строкой.
                   Если указан type и не указан format, то будет применен стандартный format
    values       - Object, используется в настройках типов list и combobox для указания вариантов выбора
      [property] - String|Object, имя свойства - значение настройки, значение содержит многоязычное значение для отображения
    render       - function( DOMtarget, current, settingName ), функция, создающая отображение как выглядит настройка на странице настроек,
                   функция render должна принимать следующие значения:
                   DOMtarget   - узел DOM, в котором нужно создать отображение
                   current     - объект USettings, созданный текущим плагином
                   settingName - имя настройки для которой создаётся отображение
                   функция render не возвращает значений
    onSet        - function( oldValue, newValue ), функция, вызываемая при изменении настройки. Её наличие не обязательно, если не требуется
                   интерактивно применять значение настройки. Когда эта функция вызывается - значение уже проверку функцией format и сохранено.

------------РАБОТА С НАСТРОЙКАМИ-----------------
1. Создать описание настроек settingsInfo - основная сложность в этом пункте, но это даст кучу плюшек -
   универсальность настроек, многоязычность интерфейса, простые настройки реализуются стандартными способами
2. Проинициализировать настройки созданием экземпляра класса window.Usettings                                let settingsObject = new window.USettings( pluginInfo, settingsInfo );
   В созданном экземпляре класса будет объект settings, а в нём все настройки.                               let settings = settingsObject.settings;
3. Так как настройки созданы для того, чтобы их менял только пользователь, то только считывать значение      alert( settings.customValue );
   настройки в коде. А вообще, не запрещены никакие манипуляции с настройками, в том числе других плагинов.  let settings = ( new window.USettings( pluginInfo, settingsInfo ) ).settings; // так лучше всего
*/
window.USettings = class {
    constructor( pluginInfo, settingsInfo ) {
        this.pluginInfo = pluginInfo;
        this.settingsInfo = settingsInfo;
        if ( !plugin.storage[ pluginInfo.pluginId ] ) plugin.storage[ pluginInfo.pluginId ] = {};
        this.storage = plugin.storage[ pluginInfo.pluginId ];
        plugin.allSettings[ pluginInfo.pluginId ] = {};
        plugin.allUnits[ pluginInfo.pluginId ] = this;
        this.settings = plugin.allSettings[ pluginInfo.pluginId ];

        let needSave = false;
        for ( let i in settingsInfo ) {
            let type = settingsInfo[i].type;
            if ( type && type in plugin.standartRenders ) settingsInfo[i].render = plugin.standartRenders[type];

            // create getter/setter
            if ( !this.storage[i] ) {
                this.storage[i] = settingsInfo[i].default;
                needSave = true;
            };
            settingsInfo[i].formatAsFunction = this.getFormatAsFunction( settingsInfo[i].format );
            let that = { // TODO: точно ли нужно замыкание контекста?
                name: i,
                oldValue: this.storage[i],
                format: settingsInfo[i].formatAsFunction,
                onSet: settingsInfo[i].onSet,
                current: this // контекст экземпляра класса
            };
            Object.defineProperty( this.settings, i, {
                get: ( function() {
                    return this.current.storage[ this.name ];
                } ).bind( that ),
                set: ( function( value ){
                    let validate = this.format( value );
                    if ( typeof validate !== "undefined" ) {
                        this.current.storage[ this.name ] = validate;
                        plugin.saveStorage();
                        if ( this.onSet ) this.onSet( this.oldValue, value )
                        this.oldValue = value;
                        return validate;
                    } else return;
                } ).bind( that )
            } );
        };
        if ( needSave ) plugin.saveStorage();
        this.renderAll();
    }

    renderAll() {
        if ( this.container ) this.container.remove();
        this.container = document.createElement( 'DIV' );
        this.container.className= "pluginView";
        this.container.innerHTML = `
        <DIV class="title info">🛈</DIV>
        <DIV class="title">${this.getLocalizedString( null, "title", this.pluginInfo )}</DIV>
        <DIV class="description">${this.getLocalizedString( null, "description", this.pluginInfo )}</DIV>
        <DIV class="settings"></DIV>
        `;
        let settingBlock = this.container.querySelector( ".settings" );
        this.container.querySelectorAll( ".title" )[1].addEventListener( "click", function( ev ) {
            $( settingBlock ).slideToggle( 300 ); // TODO: избавиться от jQuery
        } );
        for ( let i in this.settingsInfo ) {
            if ( this.settingsInfo[i].render ) {
                let oneSetting = document.createElement( 'DIV' );
                this.settingsInfo[i].container = oneSetting;
                oneSetting.className = "oneSetting";
                settingBlock.appendChild( oneSetting );
                this.settingsInfo[i].render( oneSetting, this, i );
            } else {
                console.error( `uSettings: Not exists render function or standart type for setting "${i}" in plugin "${this.pluginInfo.pluginId}".` );
            };
        };
        plugin.container.querySelector( ".usettings-container" ).appendChild( this.container );
    }

    getLocalizedString( settingName, stringName, anyObject = null ) {
        let errValue = "Error: see console.";
        let sett = anyObject ? anyObject : this.settingsInfo[ settingName ];
        if ( !sett ) {
            console.error( `uSettings: Setting with name "${settingName}" not exists.`, this );
            return errValue;
        };
        if ( !sett[ stringName ] ) {
            console.error( `uSettings: String with name "${stringName}" not exists in setting "${settingName}".`, this );
            return errValue;
        };
        let value = sett[ stringName ];
        if ( typeof value == "string" || typeof value == "number" ) return value;
        if ( typeof value == "object" ) {
            for ( let i in plugin.locales ) {
                if ( plugin.locales[i] in value ) return value[ plugin.locales[i] ];
            };
        };
        console.error( `uSettings: String with name "${stringName}" in setting "${settingName}" not localized for "en" locale.`, this );
        return errValue;
    };

    getFormatAsFunction( format ) {
        if ( typeof format == "function" ) {
            return format;
        } else if ( format.test && typeof format.test == "function") { // раз есть функция test, то это, наверно, регулярное выражение
            return ( function( value ) {
                if ( this.regex.test( value ) ) return value.toString();
            } ).bind( {regex: format} );
        } else if ( typeof format == "string" ) {
            let re, m, re2;
            re = /^string(?:(?=.*\d)\((\d*,?\d*)\))?$/i; // https://regex101.com/r/xCkd2i/2
            m = re.exec( format );
            if ( m ) {
                re2 = `^[\s\S]${m[1]?'{'+m[1]+'}':'*'}$`;
                return this.getFormatAsFunction( new RegExp( re2 ) );
            };
            m = /^(float|integer)\(([^,]+),([^,]+)\)$/i.exec( format );
            if ( m ) {
                return ( function( value ) {
                    let v = this.parse( value );
                    if ( isNaN( v ) ) return;
                    if ( this.min && this.max && ( v < this.min || v > this.max ) ) return;
                    return v;
                } ).bind( { min: parseInt(m[2]), max: parseInt(m[3]), parse: m[1] == "float" ? parseFloat : parseInt } );
            };
            re = /^boolean$/i;
            if ( re.test( format ) ) {
                return ( function( value ) {
                    return Boolean( value );
                } );
            };
            re = /^css\((.+?),(.*?)(?:,([^,]+))?\)$/i; // https://regex101.com/r/Rs7eH5/1
            m = re.exec( format );
            if ( m ) {
                return ( function( value ) {
                    if ( plugin.validateCssValue( value, this.rule, this.trustedValue, this.nodeType ) ) return value;
                } ).bind( { rule: m[1], trustedValue: m[2], nodeType: m[3] } );
            };
        };
        return this.getFormatAsFunction( "string" );// если ничего не совпало, то считаем тип строкой
    };
};

let selfSettings = {
    language: {
        type: "combobox",
        default: navigator.languages[0],
        title: {
            en: "Language",
            ru: "Язык интерфейса"
        },
        description: "<A href='javascript:location.reload();'>RELOAD</A> page for apply changes. Enter your language (two letters) <a href='https://en.wikipedia.org/wiki/List_of_ISO_639-1_codes'>Wikipedia</a>.",
        format: function( value ) {
            if ( /^[a-z]{2}$/i.test( value ) ) return value.toLowerCase();
        },
        onSet: function( oldValue, newValue ) {
            if ( oldValue !== newValue && ( newValue in this.current.settingsInfo[ this.name ].values ) ) { // onSet в замыкании, this изменен
                plugin.locales[0] = newValue;
                window.setTimeout( plugin.replaceLanguage, 500); // чтобы закончить всё, что есть в этом потоке
            };
        },
        values: {
            en: "<SPAN class='emoji'>🇬🇧</SPAN> English",
            ru: "<SPAN class='emoji'>🇷🇺</SPAN> Русский",
            de: "<SPAN class='emoji'>🇩🇪</SPAN> Deutsch",
            es: "<SPAN class='emoji'>🇪🇸</SPAN> Español",
            uk: "<SPAN class='emoji'>🇺🇦</SPAN> Українська",
            fr: "<SPAN class='emoji'>🇫🇷</SPAN> Français"
        }
    },
    fontSize: {
        type: "counter",
        from: 10,
        to: 50,
        step: 0.5,
        format: "float(10,50)",
        default: "14",
        title: {
            en: "Font size",
            ru: "Размер шрифта"
        },
        description: {
            en: "Enter fon size for settings window",
            ru: "Устанавливает размер шрифта для окна настроек (от 6 до 50)"
        },
        onSet: function( oldValue, newValue ) {
            plugin.container.style.fontSize = newValue + "px";
        }
    },
    backgroundColor: {
        type: "string",
        default: "#c0c0c060",
        title: {
            en: "Background color",
            ru: "Цвет фона"
        },
        description: {
            en: "This is HTML-color for background of modal settings window",
            ru: "Устанавливает цвет фона за пределами открытого окна настроек"
        },
        format: "css(color,red)",
        onSet: function( oldValue, newValue ) {
            plugin.container.style.backgroundColor = newValue;
        }
    },
    test: {
        type: "checkbox",
        default: false,
        title: {
            en: "Test",
            ru: "Тест"
        },
        description: {
            en: "Test",
            ru: "Тест"
        },
        format: "boolean",
    }
};

plugin.standartRenders = {
    string: function( DOMtarget, current, settingName ) {
        DOMtarget.innerHTML = `
        <DIV class="settingTitle">${current.getLocalizedString( settingName, "title" )}</DIV>
        <INPUT
            value="${plugin.escapeHTML( current.settings[settingName] )}"
            placeholder="${plugin.escapeHTML( current.settingsInfo[settingName].default )}" />
        <DIV class="description">${current.getLocalizedString( settingName, "description" )}</DIV>`;
        DOMtarget.querySelector( 'input' ).addEventListener( "keyup", (ev) => {
            current.settings[ settingName ] = ev.target.value;
            let result = current.settings[ settingName ];
            ev.target.style.backgroundColor = result == ev.target.value ? "" : "red";
        } );
    },
    list: function( DOMtarget, current, settingName ) {
        let htmlOptions = "";
        let selected, selectedVal;
        for ( let i in current.settingsInfo[settingName].values ) {
            let oneItem = `<DIV class="item" data-value="${plugin.escapeHTML(i)}"
                >${current.getLocalizedString( null, i, current.settingsInfo[settingName].values )}</DIV>`;
            if ( !selected || current.settings[settingName] == i ) {
                selected = oneItem.replace( '"item"', '"selected"' );
                selectedVal = plugin.escapeHTML( i );
            };
            htmlOptions += oneItem;
        };
        DOMtarget.innerHTML = `
        <DIV class="settingTitle">${current.getLocalizedString( settingName, "title" )}</DIV>
        <DIV class="autocomplete"><DIV class="arrow emoji">&#9207;</DIV>${selected }
        <INPUT class="selected" value="${selectedVal}" style="display:none;" />
        <DIV class="items">${htmlOptions}</DIV></DIV>
        <DIV class="description">${current.getLocalizedString( settingName, "description" )}</DIV>`;
        let div = DOMtarget.querySelector( 'div.selected' );
        let textarea = DOMtarget.querySelector( 'input.selected' );
        DOMtarget.addEventListener( 'click', (ev)=> {
            if ( ev.target.className == "item" || ( ev.target.className == 'selected' && ev.target.nodeName == 'DIV' ) ) {
                div.dataset.value = ev.target.dataset.value;
                div.innerHTML = ev.target.innerHTML;
                current.settings[settingName] = ev.target.dataset.value;
                textarea.style.backgroundColor = current.settings[settingName] !== ev.target.dataset.value ? "red" : "";
                textarea.value = ev.target.dataset.value;
                DOMtarget.querySelector( 'div.items' ).classList.toggle( 'animShow' );
            }
        } );
        DOMtarget.querySelector( '.arrow' ).addEventListener( 'click', (ev)=> {
            DOMtarget.querySelector( 'div.items' ).classList.toggle( 'animShow' );
        } );
        textarea.addEventListener( "keyup", (ev) => {
            let val = ev.target.value.toLowerCase();
            DOMtarget.querySelectorAll('.item').forEach( (item) => {
                item.style.display = ( item.textContent + " " + item.dataset.value ).toLowerCase().includes( val ) ? "block" : "none";
            } );
            current.settings[settingName] = val;
            textarea.style.backgroundColor = current.settings[settingName] !== val ? "red" : "";
        } );
        textarea.addEventListener( "focusout", (ev) => {
            let val = ev.target.value.toLowerCase();
            DOMtarget.querySelectorAll('.item').forEach( (item) => {
                item.style.display = "block";
            } );
            current.settings[settingName] = val;
            textarea.style.backgroundColor = current.settings[settingName] !== val ? "red" : "";
        } );
        textarea.addEventListener( "focusin", (ev) => {
            DOMtarget.querySelector( '.items' ).style.display = "block";
        } );
    },
    combobox: function( DOMtarget, current, settingName ) {
        plugin.standartRenders.list( DOMtarget, current, settingName ); // создали разметку за счёт list, почти одно и то же
        let container = current.settingsInfo[settingName].container;
        DOMtarget.addEventListener( 'click', (ev)=> {
            let setDisplay = function( input, div ) {
                container.querySelector( 'input.selected' ).style.display = input;
                container.querySelector( 'div.selected' ).style.display = div;
            };
            if ( ev.target.classList.contains( "selected" ) && ev.target.nodeName == 'DIV' ) setDisplay( 'block', 'none' );
            if ( ev.target.classList.contains( "item" ) ) setDisplay( 'none', 'block' );
            if ( ev.target.classList.contains( "arrow" ) ) {
                let input = container.querySelector( "input" );
                if ( input.style.display == "block" ) {
                    let matched = DOMtarget.querySelector( `div.item[data-value='${input.value}']` );
                    if ( matched && !container.querySelector( 'div.items' ).classList.contains( 'animShow' )) {
                        container.querySelector( 'div.selected' ).dataset.value = matched.dataset.value;
                        container.querySelector( 'div.selected' ).innerHTML = matched.innerHTML;
                        setDisplay( 'none', 'block' );
                    };
                };
            };
        } );
    },
    checkbox: function( DOMtarget, current, settingName ) {
        let getSymbol = function( val ) {
            return val ? "&#9745;" : "";
        };
        DOMtarget.innerHTML = `<DIV style="cursor:pointer;height: 1.8em;">
        <SPAN class="emoji checkbox settingTitle">${getSymbol(current.settings[settingName])}</SPAN>
        <DIV class="settingTitle">${current.getLocalizedString( settingName, "title" )}</DIV></DIV>
        <DIV class="description">${current.getLocalizedString( settingName, "description" )}</DIV>`;
        DOMtarget.querySelector( 'div' ).addEventListener( 'click', (ev)=> {
            let target = DOMtarget.querySelector( 'span.checkbox' );
            let newValue = !current.settings[settingName];
            target.innerHTML = getSymbol( newValue );
            current.settings[settingName] = newValue;
        } );
    },
    counter: function( DOMtarget, current, settingName ) {
        DOMtarget.innerHTML = `
        <DIV class="settingTitle">${current.getLocalizedString( settingName, "title" )}</DIV>
        <DIV class="counter">
            <BUTTON class="minus">-</BUTTON>
            <INPUT
                value="${plugin.escapeHTML( current.settings[settingName] )}"
                placeholder="${plugin.escapeHTML( current.settingsInfo[settingName].default )}" />
            <BUTTON class="plus">+</BUTTON>
        </DIV>
        <DIV class="description">${current.getLocalizedString( settingName, "description" )}</DIV>`;
        let input = DOMtarget.querySelector( 'input' );
        let step = Math.abs( current.settingsInfo[ settingName ].step );
        if ( !step ) step = 1;
        let changed = function() {
            current.settings[ settingName ] = input.value;
            let result = current.settings[ settingName ];
            input.style.backgroundColor = result.toString() == input.value ? "" : "red";
        };
        let steper = function( multiply ) {
            let result = current.settings[ settingName ] + step * multiply;
            if ( result ) {
                input.value = result;
                changed();
            };
        };
        input.addEventListener( "keyup", changed );
        DOMtarget.querySelector( '.minus' ).addEventListener( "click", steper.bind( null, -1 ) );
        DOMtarget.querySelector( '.plus' ).addEventListener( "click", steper.bind( null, 1 ) );
    },
};

plugin.standartFormats = {
    string: "string",
    list: "string",
    combobox: "string",
    checkbox: "boolean",
    counter: "integer" // для красоты. это значение будет переопределено в render
};

plugin.start = function() {
    plugin.injectCSS( `
        @font-face {
          font-family: 'Noto Color Emoji';
          src: url(https://gitcdn.xyz/repo/googlefonts/noto-emoji/master/fonts/NotoColorEmoji.ttf);
        }
        .emoji {
          font-family: 'Noto Color Emoji';
        }
        div.usettings-button {
          background-image: none; /* disable from .leaflet-control-layers-toggle */
          font-size: 28px; /* здесь абсолютное значение, а не относительно, чтобы выглядеть как в leaflet */
          line-height: 36px;
          color: dimgray;
          cursor: pointer;
        }
        div.usettings-box {
            width: 100%;
            height: 100%;
            position: absolute;
            top: 0px;
            left: 0px;
            z-index: 10000;
            background: #c0c0c060;
        }
        div.usettings-box a {
          color: blue;
        }
        div.usettings-box .usettings-container {
          display: block;
          width: 90vw;
          height: 90vh;
          top: 50%;
          left: 50%;
          transform: translate(-50%,-50%);
          position: absolute;
          background: lightgray;
          border: solid 2px gray;
          border-radius: 0.7em;
          overflow-y: auto;
        }
        div.usettings-box input, div.usettings-box select, div.usettings-box textarea, .autocomplete .selected, .autocomplete .item, div.usettings-box button {
          width: 100%;
          color:black;
          font-weight: bold;
          font-size: 1em;
          background-color: oldlace;
          height: 1.2em;
          resize: none;
        }
        div.usettings-box input {
          height: 1.629em!important;
        }
        div.usettings-box div.selected {
          width: auto;
        }
        div.usettings-box select {
          height: unset;
        }
        div.usettings-box div.pluginView {
          border: 1px blue solid;
          border-radius: 0.7em;
          margin: 0.3em;
          padding: 0.5em;
          background: lightblue;
        }
        div.usettings-box .title {
          font-weight: bold;
          font-size: 2em;
          color: darkblue;
          cursor: pointer;
        }
        div.usettings-box .settingTitle {
          font-weight: bold;
          font-size: 1.5em;
        }
        div.usettings-box .info {
          line-height: 0.7em;
          float: right;
          cursor: help;
        }
        div.usettings-box .description {
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }
        div.usettings-box .info:hover ~ .description {
          white-space: normal;
        }
        div.usettings-box .settings {
          display: none;
          padding-right: .5em;
        }
        div.usettings-box .oneSetting {
          padding: 0.7em 0 0 0.5em;
          border-radius: 0 0.7em;
        }
        div.usettings-box .oneSetting:nth-child(odd) {
          border-left: 0.2em solid blue;
        }
        div.usettings-box .oneSetting:nth-child(even) {
          border-left: 0.2em solid midnightblue;
        }
        div.usettings-box .oneSetting .description {
          max-height: 1.2em;
          transition: max-height;
        }
        div.usettings-box .oneSetting .description:hover {
          white-space: normal;
          max-height: 500em;
          transition-delay: 1.5s;
        }
        div.usettings-box .autocomplete {
          cursor: pointer;
          position: relative;
        }
        div.usettings-box .autocomplete .items {
          position: absolute;
          width: 100%;
          max-height: 0em;
          transition: 0.3s max-height 0s;
          overflow-y: auto;
          overflow-x: hidden;
        }
        div.usettings-box .autocomplete .animShow {
          max-height: 6em;
          transition: 0.3s max-height 0s;
        }
        div.usettings-box .autocomplete .item {
          margin-right: 2em;
          padding: 2px;
        }
        div.usettings-box .autocomplete .item:hover {
          background-color: rgb(118, 118, 118);
        }
        div.usettings-box .autocomplete .arrow {
          position: absolute;
          right: 0.5em;
        }
        div.usettings-box .autocomplete .selected {
          border: 1px solid rgb(118, 118, 118);
          padding: 2px;
        }
        div.usettings-box .checkbox {
          float: left;
          height: 1.1em;
          width: 1.2em;
          margin-right: 0.2em;
          border: 1px solid black;
        }
        div.usettings-box div.counter {
          display: flex;
        }
        div.usettings-box div.counter button {
          height: 1.629em;
          width: 1.629em;
        }
        div.usettings-box div.counter input {
          flex: 1;
        }
        ` );

    let thisSettings = new window.USettings( plugin_info, selfSettings );

    L.Control.USettings = L.Control.extend({
        onAdd: function( map ) {
            let container = L.DomUtil.create( "DIV" );
            container.innerHTML = `<SPAN class="emoji">&#9881;</SPAN>`;
            container.className = "usettings-button leaflet-control-layers leaflet-control-layers-toggle";
            L.DomEvent.on( container, "click", function( ev ) {
                plugin.container.style.display = "block";
            } );
            return container;
        },

        onRemove: function(map) {
        }
    } );
    L.control.usettings = new L.Control.USettings( { position: 'topright' } );
    L.control.usettings.addTo( map );
    document.body.appendChild( plugin.container );
};

let setup = plugin.start;

// PLUGIN END //////////////////////////////////////////////////////////


setup.info = plugin_info; //add the script info data to the function as a property
if(!window.bootPlugins) window.bootPlugins = [];
window.bootPlugins.push(setup);
// if IITC has already booted, immediately run the 'setup' function
if(window.iitcLoaded && typeof setup === 'function') setup();
} // wrapper end
// inject code into site context
var script = document.createElement('script');
var info = {};
if (typeof GM_info !== 'undefined' && GM_info && GM_info.script) info.script = { version: GM_info.script.version, name: GM_info.script.name, description: GM_info.script.description };
script.appendChild(document.createTextNode('('+ wrapper +')('+JSON.stringify(info)+');'));
(document.body || document.head || document.documentElement).appendChild(script);

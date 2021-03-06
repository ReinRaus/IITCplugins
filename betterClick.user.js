// ==UserScript==
// @id             iitc-plugin-betterclick@jonatkins
// @name           IITC plugin: BetterClick
// @author         ReinRaus
// @version        1.1.0
// @category       Controls
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://github.com/ReinRaus/IITCplugins/raw/main/betterClick.user.js
// @downloadURL    https://github.com/ReinRaus/IITCplugins/raw/main/betterClick.user.js
// @description    Show list for click
// @include        https://intel.ingress.com/*
// @include        http://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @match          http://intel.ingress.com/*
// ==/UserScript==

/*global
L, portals, map, $, selectPortal, renderPortalDetails
*/

function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.pluginId = 'betterClick';
plugin_info.title = "BetterClick";
plugin_info.description = {
    en: "Show list of portal if you miss.",
    ru: "Если Вы промахнулись по порталу и попали в карту, то в списке ближайших к месту нажатия порталов можно выбрать желаемый портал."
};

let settings = {radius:8}; // если плагин USettings не установлен
let settings_info = {
    radius: {
        type: "string",
        default: "8",
        format: "integer(1,100)",
        title: {
            en: "Miss radius",
            ru: "Радиус промаха"
        },
        description: {
            en: "Miss radius in percents of screen size.",
            ru: "Радиус в котором будет сформирован список порталов в процентах от размера экрана."
        },
    }
};
//END PLUGIN AUTHORS NOTE

// PLUGIN START ////////////////////////////////////////////////////////
// use own namespace for plugin
window.plugin[plugin_info.pluginId] = function() {};
var clacc = window.plugin[plugin_info.pluginId];

clacc.injectCSS = function (str) {
    var sheet = document.createElement('style')
    sheet.innerHTML = str;
    document.body.appendChild(sheet);
};

var css = `
#boxBetterClick {
    width:100%;
    height:100%;
    position:absolute;
    top:0px;
    left:0px;
    text-align: center;
    visibility: hidden;
    font-size: 3vmin;
    z-index: 10000;
    background: gray; /* older browsers */
    background: rgba(128,128,128,0.5); /* newer browsers */
}
#boxBetterClick tr:nth-child(1) {
    height: 5%;
}
#boxBetterClick tr.nth-child(2) {
    height: 85%;
}
#boxBetterClick td.list {
    vertical-align: middle;
}
#boxBetterClick td.list * {
    vertical-align: middle;
}
#boxBetterClick div.list > div {
    text-align: left;
    color: black;
    background: white;
    display: inline-block;
    cursor: pointer;
}
#boxBetterClick div.list > div > div {
    padding: 0.5vmin;
    margin: 0.2vmin;
}
#boxBetterClick div.list > div > div:hover {
    background: silver;
}
#boxBetterClick span.circle {
    width: 5vmin;
    height: 5vmin;
    border-radius: 50%;
    background-color: red;
    display: inline-block;
}
`;

clacc.distance = function( point1, point2 ) {
    return Math.sqrt( Math.pow( point1.x - point2.x, 2 ) + Math.pow( point1.y - point2.y, 2 ) );
};

clacc.getRange = function() {
    return Math.min( map._container.clientHeight, map._container.clientWidth) * parseInt( settings.radius ) / 100;
};

clacc.start = function() {
    if ( window.USettings ) {
        settings = ( new window.USettings( plugin_info, settings_info ) ).settings;
    } else {
        console.warn( "Please install USettings plugin." );
    };
    var menuBox = document.createElement( "table" );
    menuBox.id = "boxBetterClick";
    menuBox.innerHTML = `
    <TR><TD></TD><TD><DIV class='circle'></DIV></TD><TD></TD></TR>
    <TR><TD></TD>
      <TD class='list'>
        <DIV class='list'></DIV>
      </TD>
    <TD></TD></TR>`;
    document.body.appendChild( menuBox );
    clacc.injectCSS( css );

    $( menuBox ).on( "click", (event)=> {
        menuBox.style.visibility = "hidden";
        event.originalEvent.stopPropagation();
    } );

    map.on( "click", (event)=>{
        var range = clacc.getRange();
        var targetPortals = [];
        for ( let i in map._layers ) {
            if ( map._layers[i].options && map._layers[i].options.data && map._layers[i].options.data.title && clacc.distance( event.layerPoint, map._layers[i]._point) < range ) {
                targetPortals.push( {
                    title:  map._layers[i].options.data.title,
                    guid: map._layers[i].options.guid,
                    layer:  map._layers[i] } );
            };
        };

        if ( targetPortals.length > 0 ) {
            var html = "<DIV>";
            for ( let i in targetPortals ) {
                let data = targetPortals[i];
                html = html + `<DIV data-guid="${data.guid}">
                                   <SPAN class="circle" style="background-color:${data.layer.options.fillColor}; opacity:${data.layer.options.fillOpacity};" ></SPAN>
                                   ${data.title}
                               </DIV>`;
            };
            $( "#boxBetterClick div.list" ).html( html + "</DIV>" );
            menuBox.style.visibility = "visible";

            $( "#boxBetterClick div.list > div > div" ).on( "click", (ev)=>{
                    selectPortal( ev.currentTarget.dataset.guid );
                    renderPortalDetails( ev.currentTarget.dataset.guid );
                } );
        };
    } );
};

var setup = clacc.start;

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

// ==UserScript==
// @id             iitc-plugin-extendedzoomcontrol@jonatkins
// @name           IITC plugin: Extended zoom control
// @author         ReinRaus
// @version        1.0.1
// @category       Controls
// @namespace      https://github.com/jonatkins/ingress-intel-total-conversion
// @updateURL      https://github.com/ReinRaus/IITCplugins/raw/main/extendedZoomControl.user.js
// @downloadURL    https://github.com/ReinRaus/IITCplugins/raw/main/extendedZoomControl.user.js
// @description    Use buttons zoom + and - for change mobile device viewport scale
// @include        https://intel.ingress.com/*
// @include        http://intel.ingress.com/*
// @match          https://intel.ingress.com/*
// @match          http://intel.ingress.com/*
// ==/UserScript==
/*global
map, L
*/
function wrapper(plugin_info) {
// ensure plugin framework is there, even if iitc is not yet loaded
if(typeof window.plugin !== 'function') window.plugin = function() {};

//PLUGIN AUTHORS: writing a plugin outside of the IITC build environment? if so, delete these lines!!
//(leaving them in place might break the 'About IITC' page or break update checks)
plugin_info.buildName = 'release';
plugin_info.dateTimeVersion = '2021-04-05-000000';
plugin_info.pluginId = 'extZoom-control';
//END PLUGIN AUTHORS NOTE


// use own namespace for plugin
var extZoomControl = {}, zoomSwith = null, viewport = null;
window.plugin.extZoomControl = extZoomControl;

var bodyDefaultValue = parseInt( localStorage[ "plugin-" + plugin_info.pluginId ] );
if ( isNaN(bodyDefaultValue) || bodyDefaultValue < 5 || bodyDefaultValue > 1000 ) bodyDefaultValue = 100;

extZoomControl.options = {
    realState: "zoom",  // zoom | body
    realBodyValue: bodyDefaultValue, // body zoom percents
    set state( val ) {
        this.realState = val;
        zoomSwith.render();
        return val;
    },
    get state() {
        return this.realState;
    },
    set bodyValue( val ) {
        this.realBodyValue = val;
        localStorage[ "plugin-" + plugin_info.pluginId ] = val;
        map._container.style.transform = `scale(${val/100})`;
        var WH = 10000/val + "%";
        map._container.style.width = WH;
        map._container.style.height = WH;
        zoomSwith.render();
        map.invalidateSize();
        return val;
    },
    get bodyValue() {
        return this.realBodyValue;
    }
};

function setup () {
    if ( ! (L && map && map.zoomControl && map.zoomControl._container) ) {
        console.error( `{plugin_info.pluginId}:Map is not loaded`);
        return;
    };
    zoomSwith = document.createElement( "a" );
    zoomSwith.style = "line-height:12px;";
    zoomSwith.render = function() {
        var value;
        if ( extZoomControl.options.state == "zoom" ) {
            value = map.getZoom();
        } else if ( extZoomControl.options.state == "body" ) {
            value = extZoomControl.options.bodyValue;
        };
        zoomSwith.innerHTML = "<small>"+extZoomControl.options.state+" <span style='font-weight:900'>" + value + "</span></small>";
    };
    zoomSwith.onclick = function() {
        if ( extZoomControl.options.state == "body" ) {
            extZoomControl.options.state = "zoom";
            map.setZoom = map._originalSetZoom;
        } else {
            extZoomControl.options.state = "body";
            map.setZoom = function( zoom, options ) {
                if ( zoom == map.getZoom() + 1 ) {
                    extZoomControl.options.bodyValue = extZoomControl.options.bodyValue + 5;
                } else if ( zoom == map.getZoom() - 1 ) {
                    extZoomControl.options.bodyValue = extZoomControl.options.bodyValue - 5;
                };
            };
        };
    };

    map._container.style.transformOrigin = "top left";
    map.on( "zoomend", zoomSwith.render );
    map.once( "zoomstart", function() {
        extZoomControl.options.bodyValue = bodyDefaultValue;
    } );
    map.zoomControl._container.appendChild( zoomSwith );
    map._originalSetZoom = map.setZoom;

    map.on( "click", (event)=> {
        var ev = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
            offsetX: event.containerPoint.x,
            offsetY: event.containerPoint.y,
        });
        event.originalEvent.stopPropagation();
        document.body.dispatchEvent( ev );
    } );
}

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


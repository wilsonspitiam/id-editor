import { event as d3_event, mouse as d3_mouse, select as d3_select } from 'd3-selection';

import { geoVecLength } from '../geo';
import { modeBrowse } from '../modes/browse';
import { modeSelect } from '../modes/select';
import { modeSelectAiFeatures } from '../modes/select_ai_features';
import { modeSelectData } from '../modes/select_data';
import { modeSelectNote } from '../modes/select_note';
import { modeSelectError } from '../modes/select_error';
import { osmEntity, osmNote, qaError } from '../osm';


export function behaviorSelect(context) {
    // legacy option to show menu on every click
    var isShowAlways = +context.storage('edit-menu-show-always') === 1;
    var tolerance = 4;
    var _lastMouse = null;
    var _suppressMenu = true;
    var _p1 = null;


    function point() {
        return d3_mouse(context.container().node());
    }


    function keydown() {
        var e = d3_event;
        if (e && e.shiftKey) {
            context.surface()
                .classed('behavior-multiselect', true);
        }

        if (e && e.keyCode === 93) {  // context menu
            e.preventDefault();
            e.stopPropagation();
        }
    }


    function keyup() {
        var e = d3_event;
        if (!e || !e.shiftKey) {
            context.surface()
                .classed('behavior-multiselect', false);
        }


        if (e && e.keyCode === 93) {  // context menu
            e.preventDefault();
            e.stopPropagation();
            contextmenu();
        }
    }


    function mousedown() {
        if (!_p1) {
            _p1 = point();
        }
        d3_select(window)
            .on('mouseup.select', mouseup, true);

        _suppressMenu = !isShowAlways;
    }


    function mousemove() {
        if (d3_event) {
            _lastMouse = d3_event;
        }
    }


    function mouseup() {
        click();
    }


    function contextmenu() {
        var e = d3_event;
        e.preventDefault();
        e.stopPropagation();

        if (!+e.clientX && !+e.clientY) {
            if (_lastMouse) {
                e.sourceEvent = _lastMouse;
            } else {
                return;
            }
        }

        if (!_p1) {
            _p1 = point();
        }
        _suppressMenu = false;
        click();
    }


    function click() {
        d3_select(window)
            .on('mouseup.select', null, true);

        if (!_p1) return;
        var p2 = point();
        var dist = geoVecLength(_p1, p2);
        _p1 = null;
        if (dist > tolerance) return;

        // Defer processing the click,
        // because this click may trigger a blur event,
        // and the blur event may trigger a tag change,
        // and we really want that tag change to go to the already selected entity
        // and not the one that we are about to select with the click  #6028, #5878
        // (Be very careful entering modeSelect anywhere that might also blur a field!)
        var datum = d3_event.target.__data__ || (_lastMouse && _lastMouse.target.__data__);
        var isMultiselect = d3_event.shiftKey || d3_select('#surface .lasso').node();
        window.setTimeout(function() {
            processClick(datum, isMultiselect);
        }, 20);  // delay > whatever raw_tag_editor.js `scheduleChange` does (10ms).
    }


    function processClick(datum, isMultiselect) {
        var mode = context.mode();

        var entity = datum && datum.properties && datum.properties.entity;
        if (entity) datum = entity;

        if (datum && datum.type === 'midpoint') {
            datum = datum.parents[0];
        }

        if (datum && datum.__fbid__) {    // clicked an FB road ..
            context
                .enter(modeSelectAiFeatures(context, datum));

        } else if (datum instanceof osmEntity) {    // clicked an entity..
            var selectedIDs = context.selectedIDs();

            if (!isMultiselect) {
                if (selectedIDs.length > 1 && (!_suppressMenu && !isShowAlways)) {
                    // multiple things already selected, just show the menu...
                    mode.suppressMenu(false).reselect();
                } else {
                    // select a single thing..
                    context.enter(modeSelect(context, [datum.id]).suppressMenu(_suppressMenu));
                }

            } else {
                if (selectedIDs.indexOf(datum.id) !== -1) {
                    // clicked entity is already in the selectedIDs list..
                    if (!_suppressMenu && !isShowAlways) {
                        // don't deselect clicked entity, just show the menu.
                        mode.suppressMenu(false).reselect();
                    } else {
                        // deselect clicked entity, then reenter select mode or return to browse mode..
                        selectedIDs = selectedIDs.filter(function(id) { return id !== datum.id; });
                        context.enter(selectedIDs.length ? modeSelect(context, selectedIDs) : modeBrowse(context));
                    }
                } else {
                    // clicked entity is not in the selected list, add it..
                    selectedIDs = selectedIDs.concat([datum.id]);
                    context.enter(modeSelect(context, selectedIDs).suppressMenu(_suppressMenu));
                }
            }

        } else if (datum && datum.__featurehash__ && !isMultiselect) {    // clicked Data..
            context
                .enter(modeSelectData(context, datum));

        } else if (datum instanceof osmNote && !isMultiselect) {    // clicked a Note..
            context
                .enter(modeSelectNote(context, datum.id));

        } else if (datum instanceof qaError & !isMultiselect) {  // clicked an external QA error
            context
                .enter(modeSelectError(context, datum.id, datum.service));

        } else {    // clicked nothing..
            if (!isMultiselect && mode.id !== 'browse') {
                context.enter(modeBrowse(context));
            }
        }

        // reset for next time..
        _suppressMenu = true;
    }


    function behavior(selection) {
        _lastMouse = null;
        _suppressMenu = true;
        _p1 = null;

        d3_select(window)
            .on('keydown.select', keydown)
            .on('keyup.select', keyup)
            .on('contextmenu.select-window', function() {
                // Edge and IE really like to show the contextmenu on the
                // menubar when user presses a keyboard menu button
                // even after we've already preventdefaulted the key event.
                var e = d3_event;
                if (+e.clientX === 0 && +e.clientY === 0) {
                    d3_event.preventDefault();
                    d3_event.stopPropagation();
                }
            });

        selection
            .on('mousedown.select', mousedown)
            .on('mousemove.select', mousemove)
            .on('contextmenu.select', contextmenu);

        if (d3_event && d3_event.shiftKey) {
            context.surface()
                .classed('behavior-multiselect', true);
        }
    }


    behavior.off = function(selection) {
        d3_select(window)
            .on('keydown.select', null)
            .on('keyup.select', null)
            .on('contextmenu.select-window', null)
            .on('mouseup.select', null, true);

        selection
            .on('mousedown.select', null)
            .on('mousemove.select', null)
            .on('contextmenu.select', null);

        context.surface()
            .classed('behavior-multiselect', false);
    };


    return behavior;
}

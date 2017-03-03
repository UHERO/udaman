//Place all the behaviors and hooks related to the matching controller here.
//All this logic will automatically be available in application.js.
//You can use CoffeeScript in this file: http://coffeescript.org/

function toggleAllFields() {
    var me = document.getElementById('all_fields_check');
    var elements = document.querySelectorAll('[id^=field_boxes_]');
    if (me.innerHTML == 'Select all fields') {
        for (i=0; i < elements.length; i++) {
            // True for all except disabled boxes
            elements[i].checked = !elements[i].disabled;
        }
        me.innerHTML = 'Unselect all fields';
    }
    else {
        for (i=0; i < elements.length; i++) {
            elements[i].checked = false;
        }
        me.innerHTML = 'Select all fields';
    }
}

function toggleAllSeries() {
    var me = document.getElementById('all_series_check');
    var elements = document.querySelectorAll('[id^=series_boxes_]');
    if (me.innerHTML == 'Select all series') {
        for (i=0; i < elements.length; i++) {
            elements[i].checked = true;
        }
        me.innerHTML = 'Unselect all series';
    }
    else {
        for (i=0; i < elements.length; i++) {
            elements[i].checked = false;
        }
        me.innerHTML = 'Select all series';
    }
}

function replayCategoryOpenTree() {
    var nodesText = sessionStorage.getItem('udamanCatTreeOpenNodes');
    console.log("!!!!!!!!!!!!!!!!!!!! THe nodeslist is "+nodesText);
    if (nodesText == undefined) return;
    var openNodeIds = Object.keys(JSON.parse(nodesText));
    console.log("@@@@@@@@@@@@@@ The nodes array is "+openNodeIds.toString());
    for (var i = 0; i < openNodeIds.length; i++) {
        console.log("^^^^^^^^^^^^^^^^^^ doing object "+openNodeIds[i]);
        var o = document.getElementById(openNodeIds[i]);
        doowop(o);
    }
}

function doowop(the) {
    console.log("^^^^^^^^^^^^^^^^^^ object is "+the.toString());
    var ul = $(the).parent().children('ul');
    ul.toggle();
    var text = $(the).html();
    if (ul.is(':hidden')) {
        $(the).html(text.replace('-minus-', '-plus-'));
        return true
    }
    else {
        $(the).html(text.replace('-plus-', '-minus-'));
        return false
    }
}

$(function() {
    $('.category_non_leaf').click(function() {
        var nodesText = sessionStorage.getItem('udamanCatTreeOpenNodes');
        var openNodes = (nodesText == null) ? {} : JSON.parse(nodesText);
//        var ul = $(this).parent().children('ul');
//        ul.toggle();
//        var text = $(this).html();
//        if (ul.is(':hidden')) {
        if (doowop($(this))) {
//            $(this).html(text.replace('-minus-', '-plus-'));
            console.log("<<<<<<<<<<<< deleting from nodeslist: "+$(this).attr('id'));
            delete openNodes[$(this).attr('id')];
        }
        else {
//            $(this).html(text.replace('-plus-', '-minus-'));
            console.log(">>>>>>>>>>> adding to nodeslist: "+$(this).attr('id'));
            openNodes[$(this).attr('id')] = 1;
        }
        sessionStorage.setItem('udamanCatTreeOpenNodes', JSON.stringify(openNodes))
    });

    $('#toggle_all').click(function () {
        var text = $(this).html();
        if (text == 'Expand all') {
            $('.collapsible').show();
            $(this).html('Collapse all');
            $('.category_non_leaf').each(function() { $(this).html( $(this).html().replace('-plus-', '-minus-') ); });
        }
        else {
            $('.collapsible').hide();
            $(this).html('Expand all');
            $('.category_non_leaf').each(function() { $(this).html( $(this).html().replace('-minus-', '-plus-') ); });
        }
    });
});

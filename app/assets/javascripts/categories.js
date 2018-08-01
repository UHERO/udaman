function replayCategoryOpenTree() {
    var nodesText = sessionStorage.getItem('udamanCatTreeOpenNodes');
    console.log("!!!!!!!!!!!!!!!!!!!! THe nodeslist is "+nodesText);
    if (nodesText == undefined) return;
    var openNodeIds = Object.keys(JSON.parse(nodesText));
    for (var i = 0; i < openNodeIds.length; i++) {
        console.log("^^^^^^^^^^^^^^^^^^ doing object "+openNodeIds[i]);
        categoryToggleUI(document.getElementById(openNodeIds[i]));
    }
}

function categoryToggleUI(node) {
//    console.log("^^^^^^^^^^^^^^^^^^ object is "+the.toString());
    var ul = $(node).parent().children('ul');
    ul.toggle();
    var text = $(node).html();
    if (ul.is(':hidden')) {
        $(node).html(text.replace('-minus-', '-plus-'));
        return true
    }
    else {
        $(node).html(text.replace('-plus-', '-minus-'));
        return false
    }
}

$(function() {
    $('.category_non_leaf').click(function() {
        var nodesText = sessionStorage.getItem('udamanCatTreeOpenNodes');
        console.log("////////////////// Found stored opennodes |"+nodesText+"|");
        var openNodes = (nodesText == null) ? {} : JSON.parse(nodesText);
//        var ul = $(this).parent().children('ul');
//        ul.toggle();
//        var text = $(this).html();
//        if (ul.is(':hidden')) {
        if (categoryToggleUI($(this))) {
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

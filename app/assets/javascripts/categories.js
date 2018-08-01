function replayCategoryOpenTree() {
    var nodesText = sessionStorage.getItem('udamanCatTreeOpenNodes');
    if (nodesText == undefined) return;
    var openNodeIds = Object.keys(JSON.parse(nodesText));
    for (var i = 0; i < openNodeIds.length; i++) {
        categoryToggleUI(document.getElementById(openNodeIds[i]));
    }
}

function categoryToggleUI(node) {
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
        var openNodes = (nodesText == null) ? {} : JSON.parse(nodesText);
        var thisId = $(this).attr('id');
        if (categoryToggleUI($(this))) {
            delete openNodes[thisId];
        }
        else {
            openNodes[thisId] = 1;
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

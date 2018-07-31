$(function() {
    $('.category_non_leaf').click(function() {
        var nodesText = sessionStorage.getItem('categoryTreeOpenNodes');
        var openNodes = (nodesText == null) ? {} : JSON.parse(nodesText);
        var ul = $(this).parent().children('ul');
        ul.toggle();
        var text = $(this).html();
        if (ul.is(':hidden')) {
            $(this).html(text.replace('-minus-', '-plus-'));
            delete openNodes[$(this).id];
        }
        else {
            $(this).html(text.replace('-plus-', '-minus-'));
            openNodes[$(this).id] = 1;
        }
        sessionStorage.setItem('categoryTreeOpenNodes', JSON.stringify(openNodes))
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

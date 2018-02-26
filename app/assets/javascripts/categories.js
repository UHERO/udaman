$(function() {
    $('.toggler').click(function() {
        var ul = $(this).parent().children('ul');
        ul.toggle();
        if (ul.is(':hidden')) {
            $(this).html($(this).html().replace('-minus-', '-plus-'));
        }
        else {
            $(this).html($(this).html().replace('-plus-', '-minus-'));
        }
    });
    $('#toggle_all').click(function () {
        var text = $(this).html();
        if (text == 'Expand all') {
            $('.collapsible').show();
            $(this).html('Collapse all');
            $('.toggler').html(this.html().replace('-plus-', '-minus-'));
        }
        else {
            $('.collapsible').hide();
            $(this).html('Expand all');
            $('.toggler').html(this.html().replace('-minus-', '-plus-'));
        }
    });
    $("a[data-remote][data-toggle]").on("ajax:success", function(e, data, status, xhr) {
        $(this).siblings("span.hidden_cat_label").toggle();
        if ($(this).html() === 'Unhide') {
            $(this).html('Hide');
            return;
        }
        $(this).html('Unhide');
    });
});

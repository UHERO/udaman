$(function() {
    $('.toggler').click(function() {
        var ul = $(this).parent().children('ul');
        ul.toggle();
        if (ul.is(':hidden')) {
            icon = '<i class="fa fa-plus-square" aria-hidden="true"></i>';
        }
        else {
            icon = '<i class="fa fa-minus-square" aria-hidden="true"></i>';
        }
        $(this).html(icon)
    });
    $('#toggle_all').click(function () {
        var text = $(this).html();
        if (text == 'Expand all') {
            $('.collapsible').show();
            $('.toggler').html('<i class="fa fa-minus-square" aria-hidden="true"></i> ');
            $(this).html('Collapse all');
        }
        else {
            $('.collapsible').hide();
            $('.toggler').html('<i class="fa fa-plus-square" aria-hidden="true"></i> ');
            $(this).html('Expand all');
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

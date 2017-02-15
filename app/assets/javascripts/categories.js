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
});

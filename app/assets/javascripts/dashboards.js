$(function() {
    $(".button-with-indicator").on("ajax:success", function() {
        $("#pdp-indicator").removeClass('fa-spinner fa-spin').addClass('fa-check');
    });
    $(".button-with-indicator input").click(function(){
        $("#pdp-indicator").show().removeClass('fa-check').addClass('fa-spinner fa-spin');
    });
});

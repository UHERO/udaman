$(function() {
    $(".button-with-indicator").on("ajax:success", function() {
        $("#pdp-indicator").removeClass('fa-spinner fa-spin').addClass('fa-check');
    });
    $(".button-with-indicator input").click(function(){
        $("#pdp-indicator").show().removeClass('fa-check').addClass('fa-spinner fa-spin');
    });
    $(".rest-restart-button").on("ajax:success", function() {
        $("#rest-restart-indicator").show()
    });
});

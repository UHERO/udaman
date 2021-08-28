$(function() {
    $(".button-with-indicator").on("ajax:success", function() {
        $("#pdp-indicator").removeClass('fa-spinner fa-spin').addClass('fa-check').show();
    });
    $(".button-with-indicator input").click(function(){
        $("#pdp-indicator").show().removeClass('fa-check').addClass('fa-spinner fa-spin').show();
    });
    $(".rest-restart-button").on("ajax:success", function() {
        $("#rest-restart-indicator").show()
    });
    $(".dvw-restart-button").on("ajax:success", function() {
        $("#dvw-restart-indicator").show()
    });
    $(".cache-clear-button").on("ajax:success", function() {
        $("#cache-clear-indicator").show()
    });
    $(".nas-sync-button").on("ajax:success", function() {
        $("#nas-sync-indicator").removeClass('fa-spinner fa-spin').addClass('fa-check').show()
    });
    $(".nas-sync-button").on("click", function() {
        $("#nas-sync-indicator").removeClass('fa-check').addClass('fa-spinner fa-spin').show()
    });
});

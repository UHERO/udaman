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
    $(".dvw-restart-button").on("ajax:success", function() {
        $("#dvw-restart-indicator").show()
    });
    $(".nas-sync-button").on("ajax:success", function() {
        $("#nas-sync-indicator").removeClass('fa-spinner fa-spin').addClass('fa-check').show()
    });
    $(".nas-sync-button").onClick(function() {
        $("#nas-sync-indicator").show()
    });
});

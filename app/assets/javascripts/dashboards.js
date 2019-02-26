$(function() {
    $(".button-with-indicator").on("ajax:success", function() {
        $("#pdp-indicator").removeClass('fa-refresh fa-spinner').addClass('fa-check');
    });
    $(".button-with-indicator input").click(function(){
        $("#pdp-indicator").show().removeClass('fa-check').addClass('fa-refresh fa-spinner');
    });
});

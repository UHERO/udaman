$(function() {
    $("form[data-remote],input[data-pdpupdate]").on("ajax:success", function(e, data, status, xhr) {
        $("#pdp-indicator").removeClass('fa-refresh fa-spin').addClass('fa-check');
    });
    $("#pdp-button").click(function(){
        $("#pdp-indicator-span").show();
        $("#pdp-indicator").removeClass('fa-check').addClass('fa-refresh fa-spin');
    });
});

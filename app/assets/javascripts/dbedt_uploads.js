$(function() {
   $('.upload-status.processing').each(function(_, element) {
       var icon_args = $(element).attr('id').split('-');
       var which = icon_args[0];
       var dbu_id = icon_args[1];
       var intervalId = setInterval(updateClass, 2000);  // Check once every 2 seconds
       function updateClass() {
           // TODO: send request to the right url
           $.get('/dbedt_uploads/' + dbu_id + '/status/' + which, function(data) {
               // data should be the content you deliver from the status endpoint
               if (data === 'processing') {
                   // no update needed since the class is already set to processing
                   return;
               }
               if (data === 'ok') {
                   $(element).removeClass('processing fa-refresh fa-spin').addClass('ok fa-check');
                   clearInterval(intervalId);
                   return;
               }
               if (data === 'fail') {
                   $(element).removeClass('processing fa-refresh fa-spin').addClass('fail fa-times');
                   clearInterval(intervalId);
               }
           });
       }
   });
});
$(function() {
    $('.load-status.loading').each(function(_, element) {
        var icon_args = $(element).attr('id').split('-');
        var dbu_id = icon_args[1];
        var intervalId = setInterval(updateClass, 2000);  // Check once every 2 seconds
        function updateClass() {
            // TODO: send request to the right url
            $.get('/dbedt_uploads/' + dbu_id + '/active_status', function(data) {
                // data should be the content you deliver from the status endpoint
                if (data === 'loading') {
                    // no update needed since the class is already set to processing
                    return;
                }
                if (data === 'yes') {
                    $(element).removeClass('loading fa-refresh fa-spin').addClass('load-yes fa-dot-circle-o');
                    clearInterval(intervalId);
                    return;
                }
                if (data === 'fail') {
                    $(element).removeClass('loading fa-refresh fa-spin').addClass('load-fail fa-times');
                    clearInterval(intervalId);
                }
            });
        }
    });
});

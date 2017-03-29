$(function() {
   $('.upload-status.processing').each(function(_, element) {
       var icon_args = $(element).attr('id').split('-');
       var upload_type = icon_args[0];
       var dbu_id = icon_args[1];
       var intervalId = setInterval(updateClass, 2000);
       function updateClass() {
           $.get('/dbedt_uploads/' + dbu_id + '/status/' + upload_type, function(data) {
               if (data === 'processing') {
                   // no update needed since the class is already set to processing
                   return;
               }
               if (data === 'ok') {
                   $(element).removeClass('processing fa-refresh fa-spin').addClass('ok fa-check');
                   if ($(element).parent().siblings().has('i.fa-check').length === 1) {
                       $(element).parent().siblings().has('span.waiting').children('span').removeClass('waiting');
                       location.reload();
                   }
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

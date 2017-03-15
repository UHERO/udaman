$(function() {
   $('.upload-status.processing').each(function(_, element) {
       // This assumes you give each upload-status element an id like "upload-123" where 123 is the dbedt_uploads_id
       var icon_args = $(element).attr('id').split('-');
       var which = icon_args[0];
       var dbu_id = icon_args[1];
       // Check once a second
       var intervalId = setInterval(updateClass, 1000);
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
               if (data === 'failure') {
                   $(element).removeClass('processing fa-refresh fa-spin').addClass('fail fa-times');
                   clearInterval(intervalId);
               }
           });
       }
   });
});

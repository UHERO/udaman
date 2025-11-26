class DbedtUploadMailer < ApplicationMailer
  default from: 'udaman.bot@gmail.com'

  NOTIFICATION_RECIPIENTS = [
    'wood2@hawaii.edu',
    'vward@hawaii.edu',
    'paul.t.oshiro@hawaii.gov'    # Paul uploads the files from DBEDT 1-2x per month
  ]

  def upload_started(upload)
    @upload = upload
    @upload_id = upload.id
    @filename = upload.filename
    @upload_time = upload.upload_at

    mail(
      to: NOTIFICATION_RECIPIENTS,
      subject: "DBEDT Upload Started: #{@filename}"
    )
  end

  def upload_completed(upload)
    @upload = upload
    @upload_id = upload.id
    @filename = upload.filename
    @upload_time = upload.upload_at
    @status = upload.status
    @message = upload.last_error

    subject = @status == 'ok' ?
      "DBEDT Upload Successful: #{@filename}" :
      "DBEDT Upload Failed: #{@filename}"

    mail(
      to: NOTIFICATION_RECIPIENTS,
      subject: subject
    )
  end
end

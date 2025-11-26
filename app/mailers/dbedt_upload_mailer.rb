class DbedtUploadMailer < ApplicationMailer
  default from: 'udaman.bot@gmail.com'

  def upload_started(upload)
    @upload = upload
    @upload_id = upload.id
    @filename = upload.filename
    @upload_time = upload.upload_at

    mail(
      to: 'wood2@hawaii.edu',
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
      to: 'wood2@hawaii.edu',
      subject: subject
    )
  end
end

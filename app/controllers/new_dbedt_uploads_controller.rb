class NewDbedtUploadsController < ApplicationController
  include Authorization

  before_action :check_dbedt_upload_authorization
  before_action :set_db_upload, only: [:show, :status, :active_status]

  def index
    @new_db_upload = NewDbedtUpload.new
    @db_uploads = NewDbedtUpload.all.order(upload_at: :desc)
  end

  def show
    send_file @db_upload.absolute_path
  end

  def new
  end

  def update
  end

  def create
    @db_upload = NewDbedtUpload.new(db_upload_params)

    unless @db_upload.store_upload_file(@db_upload.filename)
      redirect_to action: :index
      return
    end
    redirect_to({ action: :index }, notice: 'DBEDT Upload was successfully stored.')
  end

  def active_status
    render plain: @db_upload.active, status: 200, content_type: 'text/plain'
  end

  def status
    render plain: @db_upload.status, status: 200, content_type: 'text/plain'
  end

private

  def set_db_upload
    @db_upload = NewDbedtUpload.find(params[:id])
  end

  def db_upload_params
    params.require(:new_db_upload).permit(:filename)
  end
end

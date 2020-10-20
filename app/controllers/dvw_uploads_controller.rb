class DvwUploadsController < ApplicationController
  include Authorization

  before_action :check_dbedt_upload_authorization
  before_action :set_dvw_upload, only: [:show, :status, :active_status, :make_active, :destroy]

  def index
    @new_dvw_upload = DvwUpload.new
    @dvw_uploads = DvwUpload.all.order(upload_at: :desc)
  end

  def show
    send_file @dvw_upload.absolute_path(params[:filetype])
  end

  def new
  end

  def create
    @dvw_upload = DvwUpload.new(dvw_upload_params)

    unless @dvw_upload.store_upload_files(dvw_upload_params[:filename])
      redirect_to action: :index
      return
    end
    redirect_to({ action: :index }, notice: 'DVW upload was successfully stored.')
  end

  def make_active
    @dvw_upload.make_active
    redirect_to action: :index
  end

  def active_status
    render plain: @dvw_upload.active, status: 200, content_type: 'text/plain'
  end

  def status
    render plain: @dvw_upload.get_status(params[:which]), status: 200, content_type: 'text/plain'
  end

  def update
  end

  def destroy
    @dvw_upload.destroy
    redirect_to({ action: :index }, notice: 'DVW upload was successfully destroyed.')
  end

private

  # Use callbacks to share common setup or constraints between actions.
  def set_dvw_upload
    @dvw_upload = DvwUpload.find params[:id]
  end

  # Only allow a trusted parameter "white list" through.
  def dvw_upload_params
    params.require(:dvw_upload).permit(:filetype, :filename)
  end
end

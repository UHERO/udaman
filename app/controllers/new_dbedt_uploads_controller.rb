class NewDbedtUploadsController < ApplicationController
  include Authorization

  before_action :check_dbedt_upload_authorization
  before_action :set_dvw_upload, only: [:show, :status, :active_status, :make_active, :destroy]

  def index
    @new_dvw_upload = NewDbedtUpload.new
    @dvw_uploads = NewDbedtUpload.all.order(upload_at: :desc)
  end

  def show
    send_file @dvw_upload.absolute_path(params[:filetype])
  end

  def new
  end

  def create
    @dbedt_upload = NewDbedtUpload.new(dbedt_upload_params)

    unless @dbedt_upload.store_upload_files(dbedt_upload_params[:filename])
      redirect_to action: :index
      return
    end
    redirect_to({ action: :index }, notice: 'DBEDT upload was successfully stored.')
  end

  def make_active
    @dbedt_upload.make_active
    redirect_to action: :index
  end

  def active_status
    render plain: @dbedt_upload.active, status: 200, content_type: 'text/plain'
  end

  def status
    render plain: @dbedt_upload.get_status(params[:which]), status: 200, content_type: 'text/plain'
  end

  def update
  end

  def destroy
    @dvw_upload.destroy
    redirect_to({ action: :index }, notice: 'DVW upload was successfully destroyed.')
  end

private

    # Use callbacks to share common setup or constraints between actions.
    def set_dbedt_upload
      @dbedt_upload = NewDbedtUpload.find params[:id]
    end

    # Only allow a trusted parameter "white list" through.
    def dbedt_upload_params
      params.require(:new_dbedt_upload).permit(:filetype, :filename)
    end
end

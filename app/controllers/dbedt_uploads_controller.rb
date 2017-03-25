class DbedtUploadsController < ApplicationController
  include Authorization

  before_action :check_dbedt_upload_authorization
  before_action :set_dbedt_upload, only: [:show, :status, :active_status, :make_active, :destroy]

  # GET /dbedt_uploads
  def index
    @new_dbedt_upload = DbedtUpload.new
    @dbedt_uploads = DbedtUpload.all.order('upload_at desc')
  end

  # GET /dbedt_uploads/1
  def show
    send_file @dbedt_upload.absolute_path(params[:filetype])
  end

  # GET /dbedt_uploads/new
  def new
  end

  # POST /dbedt_uploads
  def create
    @dbedt_upload = DbedtUpload.new(dbedt_upload_params)

    unless @dbedt_upload.store_upload_files(dbedt_upload_params[:cats_filename], dbedt_upload_params[:series_filename])
      redirect_to(action: 'index')
      return
    end
    redirect_to({action: 'index'}, notice: 'DBEDT upload was successfully stored.')
  end

  def make_active
    @dbedt_upload.update :cats_status => 'processing', :series_status => 'processing'
    @dbedt_upload.set_active 'loading'
    redirect_to(action: 'index')
  end

  def active_status
    render(text: @dbedt_upload.active, status: 200)
  end

  def status
    render text: @dbedt_upload.get_status(params[:which]), status: 200
  end

  # PATCH/PUT /dbedt_uploads/1
  def update
  end

  # DELETE /dbedt_uploads/1
  def destroy
    @dbedt_upload.destroy
    redirect_to({action: 'index'}, notice: 'DBEDT upload was successfully destroyed.')
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_dbedt_upload
      @dbedt_upload = DbedtUpload.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def dbedt_upload_params
      params.require(:dbedt_upload).permit(:filetype, :cats_filename, :series_filename)
    end
end

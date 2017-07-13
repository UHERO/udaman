class NtaUploadsController < ApplicationController
  include Authorization

  before_action :check_nta_upload_authorization
  before_action :set_nta_upload, only: [:show, :status, :active_status, :make_active, :destroy]

  # GET /nta_uploads
  def index
    @new_nta_upload = NtaUpload.new
    @nta_uploads = NtaUpload.all.order(upload_at: :desc)
  end

  # GET /nta_uploads/1
  def show
    send_file @nta_upload.absolute_path(params[:filetype])
  end

  # GET /nta_uploads/new
  def new
  end

  # POST /nta_uploads
  def create
    @nta_upload = NtaUpload.new(nta_upload_params)

    unless @nta_upload.store_upload_files(nta_upload_params[:series_filename])
      redirect_to(action: 'index')
      return
    end
    redirect_to({action: 'index'}, notice: 'NTA upload was successfully stored.')
  end

  def make_active
    false && @nta_upload.make_active  ### TEMP: during development
    redirect_to(action: 'index')
  end

  def active_status
    render(text: @nta_upload.active, status: 200)
  end

  def status
    render text: @nta_upload.get_status(params[:which]), status: 200
  end

  # PATCH/PUT /nta_uploads/1
  def update
  end

  # DELETE /nta_uploads/1
  def destroy
    @nta_upload.destroy
    redirect_to({action: 'index'}, notice: 'NTA upload was successfully destroyed.')
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_nta_upload
      @nta_upload = NtaUpload.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def nta_upload_params
      params.require(:nta_upload).permit(:filetype, :series_filename)
    end
end

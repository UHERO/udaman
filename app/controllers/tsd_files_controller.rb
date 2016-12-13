class TsdFilesController < ApplicationController
  before_action :set_tsd_file, only: [:show, :edit, :update, :destroy]

  # GET /tsd_files
  def index
    @tsd_files = TsdFile.all
  end

  # GET /tsd_files/1
  def show
  end

  # GET /tsd_files/new
  def new
    @tsd_file = TsdFile.new
  end

  # GET /tsd_files/1/edit
  def edit
  end

  # POST /tsd_files
  def create
    @tsd_file = TsdFile.new(tsd_file_params)

    if @tsd_file.save
      redirect_to @tsd_file, notice: 'Tsd file was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /tsd_files/1
  def update
    if @tsd_file.update(tsd_file_params)
      redirect_to @tsd_file, notice: 'Tsd file was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /tsd_files/1
  def destroy
    @tsd_file.destroy
    redirect_to tsd_files_url, notice: 'Tsd file was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_tsd_file
      @tsd_file = TsdFile.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def tsd_file_params
      params.require(:tsd_file).permit(:path, :latest)
    end
end

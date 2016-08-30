class ApiApplicationsController < ApplicationController
  before_action :set_api_application, only: [:show, :edit, :update, :destroy]

  # GET /api_applications
  def index
    @api_applications = ApiApplication.all
  end

  # GET /api_applications/1
  def show
  end

  # GET /api_applications/new
  def new
    @api_application = ApiApplication.new
  end

  # GET /api_applications/1/edit
  def edit
  end

  # POST /api_applications
  def create
    @api_application = ApiApplication.new(api_application_params)

    if @api_application.save
      redirect_to @api_application, notice: 'Api application was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /api_applications/1
  def update
    if @api_application.update(api_application_params)
      redirect_to @api_application, notice: 'Api application was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /api_applications/1
  def destroy
    @api_application.destroy
    redirect_to api_applications_url, notice: 'Api application was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_api_application
      @api_application = ApiApplication.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def api_application_params
      params.require(:api_application).permit(:name, :hostname, :key)
    end
end

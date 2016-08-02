class ApiUsersController < ApplicationController
  before_action :set_api_user, only: [:show, :edit, :update, :destroy]

  # GET /api_users
  def index
    @api_users = ApiUser.all
  end

  # GET /api_users/1
  def show
  end

  # GET /api_users/new
  def new
    @api_user = ApiUser.new
  end

  # GET /api_users/1/edit
  def edit
  end

  # POST /api_users
  def create
    @api_user = ApiUser.new(api_user_params)

    if @api_user.save
      redirect_to @api_user, notice: 'Api user was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /api_users/1
  def update
    if @api_user.update(api_user_params)
      redirect_to @api_user, notice: 'Api user was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /api_users/1
  def destroy
    @api_user.destroy
    redirect_to api_users_url, notice: 'Api user was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_api_user
      @api_user = ApiUser.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def api_user_params
      params.require(:api_user).permit(:key, :email, :name)
    end
end

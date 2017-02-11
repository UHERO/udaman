class UserFeedbacksController < ApplicationController
  before_action :set_user_feedback, only: [:show, :edit, :update, :destroy]

  # GET /user_feedbacks
  def index
    @user_feedbacks = UserFeedback.all
  end

  # GET /user_feedbacks/1
  def show
  end

  # GET /user_feedbacks/new
  def new
    @user_feedback = UserFeedback.new
  end

  # GET /user_feedbacks/1/edit
  def edit
  end

  # POST /user_feedbacks
  def create
    @user_feedback = UserFeedback.new(user_feedback_params)

    if @user_feedback.save
      redirect_to @user_feedback, notice: 'User feedback was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /user_feedbacks/1
  def update
    if @user_feedback.update(user_feedback_params)
      redirect_to @user_feedback, notice: 'User feedback was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /user_feedbacks/1
  def destroy
    @user_feedback.destroy
    redirect_to user_feedbacks_url, notice: 'User feedback was successfully destroyed.'
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_user_feedback
      @user_feedback = UserFeedback.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def user_feedback_params
      params.require(:user_feedback).permit(:name, :email, :feedback, :notes, :resolved)
    end
end

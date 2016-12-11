require 'active_support/rescuable'
module Authorization
  extend ActiveSupport::Concern

  EDIT_ACTIONS = %w(edit inline_update update up down new bulk_new create bulk_create)

  included do
    include ActiveSupport::Rescuable
    # when we move to rails 5 we can use redirect_back instead of redirect_to(:back) below
    rescue_from ActionController::RedirectBackError, with: :redirect_to_default
  end

  def check_data_list_authorization
    if DataList.find_by(id: params[:id]).owned_by == current_user.id
      return
    end
    unless current_user.internal_user?
      redirect_to :back, flash: {error: 'Not Authorized to view'}
      return
    end
    if !current_user.admin_user? && !Authorization::EDIT_ACTIONS.index(params[:action]).nil?
      puts 'not admin AND edit command'
      redirect_to :back, flash: {error: 'Not Authorized to edit'}
      return
    end
    if !current_user.dev_user? && params[:action] == 'destroy'
      redirect_to :back, flash: {error: 'Not Authorized to destroy'}
    end
  end

  def check_authorization
    unless current_user.internal_user?
      redirect_to :back, flash: {error: 'Not Authorized to view'}
      return
    end
    if !current_user.admin_user? && !Authorization::EDIT_ACTIONS.index(params[:action]).nil?
      puts 'not admin AND edit command'
      redirect_to :back, flash: {error: 'Not Authorized to edit'}
      return
    end
    if !current_user.dev_user? && params[:action] == 'destroy'
      redirect_to :back, flash: {error: 'Not Authorized to destroy'}
    end
  end

  def redirect_to_default
    redirect_to root_path, flash: {error: 'Not Authorized'}
  end
end

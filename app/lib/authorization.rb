require 'active_support/rescuable'
module Authorization
  extend ActiveSupport::Concern

  EDIT_ACTIONS = %w(edit inline_update update up down new bulk_new create bulk_create)

  def check_data_list_authorization
    if current_user.internal_user? && (%w(index new create duplicate save_as_text).include?(params[:action]) || owns_data_list?(params[:id]))
      return
    end
    check_authorization
  end

  def check_forecast_snapshot_authorization
    if current_user.heco? && (%w(index show table).include?(params[:action]))
      return
    end
    if current_user.admin_user? && %w(delete destroy).include?(params[:action])
      return
    end
    check_authorization
  end

  def check_dbedt_upload_authorization
    if current_user.dbedt?
      return
    end
    check_authorization
  end

  def check_authorization
    unless current_user.internal_user?
      redirect_back fallback_location: '/', flash: { error: 'Access not authorized' }
      return
    end
    if Authorization::EDIT_ACTIONS.include?(params[:action]) && !current_user.admin_user?
      redirect_back fallback_location: '/', flash: { error: 'Edit not authorized' }
      return
    end
    if params[:action] == 'destroy' && !current_user.dev_user?
      redirect_back fallback_location: '/', flash: { error: 'Destroy not authorized' }
      return
    end
    true
  end

private

  def owns_data_list?(data_list_id)
    dlist = DataList.find(data_list_id) rescue raise("Cannot find Data List with id=#{data_list_id}")
    dlist.owned_by == current_user.id
  end
end

class LoadersController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_loader, except: [:new, :create]

  def source
    @loader.reload_source
    redirect_to controller: :series, action: :show, id: @loader.series_id
  end

  def clear
  end

  def do_clear
    cutoff_date = clear_params[:date].nil_blank  ## will be nil when all points are to be cleared
    delete_method_param = {}
    if cutoff_date
      if clear_params[:type].blank?
        redirect_to action: :clear, id: @loader
        return
      end
      delete_method_param = { clear_params[:type].to_sym => cutoff_date }
    end
    @loader.delete_data_points(**delete_method_param)  ## double splat for hash
    @loader.series.repair_currents!
    @loader.reset
    redirect_to controller: :series, action: :show, id: @loader.series_id
  end
  
  def delete
    if @loader.destroy
      create_action @loader, 'DELETE'
    end
    redirect_to controller: :series, action: :show, id: @loader.series_id
  end

  def reset
    @loader.reset
    redirect_to controller: :series, action: :show, id: @loader.series_id
  end

  def disable
    @loader.disable!
    redirect_to controller: :series, action: :show, id: @loader.series_id
  end

  def toggle_reload_nightly
    @loader.toggle_reload_nightly
    redirect_to controller: :series, action: :show, id: @loader.series_id
  end

  def new
    @series = Series.find params[:series_id]
    @loader = Loader.new(:series_id => @series.id)
  end

  def show
    redirect_to controller: :series, action: :show, id: @loader.series_id
  end

  def edit
    @disab = @loader.disabled?
  end

  def update
    update_attrs = loader_params
    eval_changed = (@loader.eval != update_attrs[:eval].strip)
    ph_changed = (@loader.pseudo_history? != update_attrs[:pseudo_history].to_bool)
    update_attrs[:scale] = update_attrs[:scale].to_f.to_s  ## normalize the scaling factor format

    if @loader.update!(update_attrs)
      @loader.setup if eval_changed
      @loader.mark_data_as_pseudo_history(@loader.pseudo_history?) if ph_changed
      create_action @loader, 'UPDATE'
      redirect_to :controller => 'series', :action => 'show', :id => @loader.series_id
    else
      redirect_to :controller => 'series', :action => 'show', :id => @loader.series_id
    end
  end

  def inline_update
    if @loader.update_attributes(eval: loader_params[:eval])
      create_action @loader, 'UPDATE'
      begin
        render partial: 'inline_edit', locals: {:ds => @loader, :notice => "OK, (#{@loader.series.aremos_diff})"}
      rescue
        render partial: 'inline_edit', locals: {:ds => @loader, :notice => 'BROKE ON LOAD'}
      end
    else
      render partial: 'inline_edit', locals: {:ds => @loader, :notice => 'BROKE ON SAVE'}
    end
  end
  
  def create
    create_attrs = loader_params
    create_attrs[:scale] = create_attrs[:scale].to_f.to_s  ## normalize the scaling factor format

    @loader = Loader.new(create_attrs)
    if @loader.create_from_form
      create_action @loader.series.loaders_by_last_run.first, 'CREATE'
      redirect_to :controller => 'series', :action => 'show', :id => @loader.series_id, :notice => 'Loader saved successfully'
    else
      @series = Series.find_by id: @loader.series_id
      render :action => 'new', :series_id => @loader.series_id
    end
  end

private

  def set_loader
    @loader = Loader.find params[:id]
  end

  def loader_params
      params.require(:loader).permit(:series_id, :eval, :priority, :scale, :color, :presave_hook, :pseudo_history, :clear_before_load)
  end

  def clear_params
    params.require(:clear_op).permit(:date, :type)
  end

  def create_action(loader, action)
    LoaderAction.create do |lac|
      lac.loader_id = loader.id
      lac.series_id = loader.series.id
      lac.user_id = current_user.id
      lac.user_email = current_user.email
      lac.eval = loader.eval
      lac.priority = loader.priority
      lac.action = action
    end
  end
end

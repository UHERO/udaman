class LoadersController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_loader, except: [:new, :create]

  def source
    @loader.reload_source
    redirect_to controller: :series, action: :show, id: @loader.series_id
  end
  
  def clear
    @loader.delete_data_points
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
    if @loader.update!(loader_params)
      @loader.setup  ## in case the eval was changed
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
    @loader = Loader.new(loader_params)
    if @loader.create_from_form
      create_action @loader.series.loaders_by_last_run.first, 'CREATE'
      redirect_to :controller => 'series', :action => 'show', :id => @loader.series_id, :notice => 'Definition processed successfully'
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
      params.require(:loader).permit(:series_id, :eval, :priority, :color, :presave_hook, :pseudo_history, :clear_before_load)
  end

  def create_action(loader, action)
    LoaderAction.create do |dsa|
      dsa.loader_id = loader.id
      dsa.series_id = loader.series.id
      dsa.user_id = current_user.id
      dsa.user_email = current_user.email
      dsa.eval = loader.eval
      dsa.priority = loader.priority
      dsa.action = action
    end
  end
end

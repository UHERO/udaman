class DataSourcesController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_data_source, except: [:new, :create, :do_clear]

  def source
    @data_source.reload_source
    redirect_to controller: :series, action: :show, id: @data_source.series_id
  end

  def clear
  end

  def do_clear
    cutoff_date = clear_params[:date].nil_blank  ## will be nil when all points are to be cleared
    if cutoff_date && clear_params[:type].blank?
      redirect_to :clear
    end
    delete_method_param = cutoff_date ? { clear_params[:type] => cutoff_date } : {}
    @data_source.delete_data_points(*delete_method_param)
    @data_source.reset
    redirect_to controller: :series, action: :show, id: @data_source.series_id
  end
  
  def delete
    if @data_source.destroy
      create_action @data_source, 'DELETE'
    end
    redirect_to controller: :series, action: :show, id: @data_source.series_id
  end

  def reset
    @data_source.reset
    redirect_to controller: :series, action: :show, id: @data_source.series_id
  end

  def disable
    @data_source.disable!
    redirect_to controller: :series, action: :show, id: @data_source.series_id
  end

  def toggle_reload_nightly
    @data_source.toggle_reload_nightly
    redirect_to controller: :series, action: :show, id: @data_source.series_id
  end

  def new
    @series = Series.find params[:series_id]
    @data_source = DataSource.new(:series_id => @series.id)
  end

  def show
    redirect_to controller: :series, action: :show, id: @data_source.series_id
  end

  def edit
    @disab = @data_source.disabled?
  end

  def update
    eval_changed = (@data_source.eval != data_source_params[:eval].strip)
    ph_changed = (@data_source.pseudo_history? != data_source_params[:pseudo_history].to_bool)

    if @data_source.update!(data_source_params)
      @data_source.setup if eval_changed
      @data_source.mark_data_as_pseudo_history(@data_source.pseudo_history?) if ph_changed
      create_action @data_source, 'UPDATE'
      redirect_to :controller => 'series', :action => 'show', :id => @data_source.series_id
    else
      redirect_to :controller => 'series', :action => 'show', :id => @data_source.series_id
    end
  end

  def inline_update
    if @data_source.update_attributes(eval: data_source_params[:eval])
      create_action @data_source, 'UPDATE'
      begin
        render partial: 'inline_edit', locals: {:ds => @data_source, :notice => "OK, (#{@data_source.series.aremos_diff})"}
      rescue
        render partial: 'inline_edit', locals: {:ds => @data_source, :notice => 'BROKE ON LOAD'}
      end
    else
      render partial: 'inline_edit', locals: {:ds => @data_source, :notice => 'BROKE ON SAVE'}
    end
  end
  
  def create
    @data_source = DataSource.new(data_source_params)
    if @data_source.create_from_form
      create_action @data_source.series.data_sources_by_last_run.first, 'CREATE'
      redirect_to :controller => 'series', :action => 'show', :id => @data_source.series_id, :notice => 'Definition processed successfully'
    else
      @series = Series.find_by id: @data_source.series_id
      render :action => 'new', :series_id => @data_source.series_id
    end
  end

private

  def set_data_source
    @data_source = DataSource.find params[:id]
  end

  def data_source_params
      params.require(:data_source).permit(:series_id, :eval, :priority, :color, :presave_hook, :pseudo_history, :clear_before_load)
  end

  def clear_params
    params.require(:clear_op).permit(:date, :type)
  end

  def create_action(data_source, action)
    DataSourceAction.create do |dsa|
      dsa.data_source_id = data_source.id
      dsa.series_id = data_source.series.id
      dsa.user_id = current_user.id
      dsa.user_email = current_user.email
      dsa.eval = data_source.eval
      dsa.priority = data_source.priority
      dsa.action = action
    end
  end
end

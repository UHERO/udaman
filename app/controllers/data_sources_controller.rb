class DataSourcesController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_data_source, except: [:new, :create]

  def source
    @data_source.reload_source
    redirect_to controller: :series, action: :show, id: @data_source.series_id
  end
  
  def clear
    @data_source.delete_data_points
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
  end

  def toggle_reload_nightly
    @data_source.toggle_reload_nightly
    redirect_to controller: :series, action: :show, id: @data_source.series_id
  end

  def new
    @series = Series.find data_source_params[:series_id]
    @data_source = DataSource.new(:series_id => @series.id)
  end

  def show
    redirect_to controller: :series, action: :show, id: @data_source.series_id
  end

  def edit
  end

  def update
    if @data_source.update_attributes(eval: data_source_params[:eval], priority: data_source_params[:priority])
      create_action @data_source, 'UPDATE'
      redirect_to :controller => 'series', :action => 'show', :id => @data_source.series_id, :notice => 'datasource processed successfully'
    else
      redirect_to :controller => 'series', :action => 'show', :id => @data_source.series_id, :notice => 'datasource had a problem'
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
    @data_source = DataSource.new data_source_params
    if @data_source.create_from_form
      create_action @data_source.series.data_sources_by_last_run.first, 'CREATE'
      redirect_to :controller => 'series', :action => 'show', :id => @data_source.series_id, :notice => 'datasource processed successfully'
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
      params.require(:data_source).permit(:series_id, :eval, :priority)
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

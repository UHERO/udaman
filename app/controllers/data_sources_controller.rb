class DataSourcesController < ApplicationController
  include Authorization

  before_action :check_authorization
  #can eventually move this to a data_source_controller when
  #that's developed for other source editing facilities
  def source
    source = DataSource.find_by id: params[:id]
    source.reload_source
    redirect_to :controller=> 'series', :action => 'show', :id => source.series_id
  end
  
  def clear_and_reload
    source = DataSource.find_by id: params[:id]
    source.clear_and_reload_source
    redirect_to :controller=> 'series', :action => 'show', :id => source.series_id
  end
  
  def delete
    source = DataSource.find_by id: params[:id]
    create_action source,'DELETE'
    source.delete
    redirect_to :controller=> 'series', :action => 'show', :id => source.series_id
  end

  def toggle_reload_nightly
    source = DataSource.find_by id: params[:id]
    source.toggle_reload_nightly
    redirect_to controller: :series, action: :show, id: source.series_id
  end

  def new
    #params.each { |key,value| puts "#{key}: #{value}" }
    @series = Series.find_by id: params[:series_id]
    @data_source = DataSource.new(:series_id => @series.id)
  end

  def edit
    @data_source = DataSource.find_by id: params[:id]
  end

  def update
    #params.each { |key,value| puts "#{key}: #{value}" }
    
    @data_source = DataSource.find_by id: params[:id]
    @data_source.update_attributes(:priority => params[:data_source][:priority].to_i)
    if @data_source.update_attributes(:eval => params[:data_source][:eval])
      create_action @data_source, 'UPDATE'
      @data_source.reload_source
      redirect_to :controller => 'series', :action => 'show', :id => @data_source.series_id, :notice => 'datasource processed successfully'
    else
      redirect_to :controller => 'series', :action => 'show', :id => @data_source.series_id, :notice => 'datasource had a problem'
    end
  end
  
  def inline_update
      #params.each { |key,value| puts "#{key}: #{value}" }
    
     @data_source = DataSource.find_by id: params[:id]
     if @data_source.update_attributes(:eval => params[:data_source][:eval])
        begin
          @data_source.reload_source
          render :partial => 'inline_edit.html', :locals => {:ds => @data_source, :notice => "OK, (#{@data_source.series.aremos_diff})"}
        rescue
          render :partial => 'inline_edit.html', :locals => {:ds => @data_source, :notice => 'BROKE ON LOAD'}
        end
      else
        render :partial => 'inline_edit.html', :locals => {:ds => @data_source, :notice => 'BROKE ON SAVE'}
      end
  end
  
  def create
    params.each { |key,value| puts "#{key}: #{value}" }
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

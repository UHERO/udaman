class DataPointsController < ApplicationController
  def show
    @series = Series.find_by id: params[:series_id]
    @as = AremosSeries.get @series.name
    @desc = @as.nil? ? "No Aremos Series" : @as.description
    @data_points = DataPoint.where(:series_id => params[:series_id], :date_string => params[:date_string])
    @date_string = params[:date_string]
  end
end

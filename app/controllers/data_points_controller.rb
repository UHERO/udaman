class DataPointsController < ApplicationController
  def show
    @data_points = DataPoint.where(:series_id => params[:series_id], :date => params[:date_string])
  end
end

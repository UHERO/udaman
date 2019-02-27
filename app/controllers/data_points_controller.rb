class DataPointsController < ApplicationController
  include Authorization

  before_action :check_authorization

  def show
    series_id = params[:series_id].to_i
    date = params[:date].to_s
    @data_points = DataPoint.where(series_id: series_id, date: date)
  end
end

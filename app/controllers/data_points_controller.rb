class DataPointsController < ApplicationController
  include Authorization

  before_action :check_authorization

  def show
    @data_points = DataPoint.where(:series_id => params[:series_id], :date => params[:date])
  end
end

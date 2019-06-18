class DataPointsController < ApplicationController
  include Authorization

  before_action :check_authorization

  def show
    @data_points = DataPoint.joins(:xseries)
                            .where('primary_series_id = ? and date = ?', params[:series_id].to_i, params[:date].to_s)
  end
end

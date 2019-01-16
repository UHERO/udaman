class DataPointsController < ApplicationController
  include Authorization

  before_action :check_authorization

  def show
    @data_points = DataPoint.where(series_id: data_point_params[:series_id],
                                   date: data_point_params[:date])
  end

private
  def data_point_params
    params.require(:data_point).permit(:series_id, :date)
  end
end

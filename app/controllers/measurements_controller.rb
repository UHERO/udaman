class MeasurementsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_measurement, only: [:show, :edit, :update, :add_series, :remove_series, :destroy]

  # GET /measurements
  def index
    if params[:unrestricted]
      @measurements = Measurement.includes(:series).where(:series => {:restricted => false}).order(:prefix)
      return
    end
    @measurements = Measurement.all
  end

  # GET /measurements/1
  def show
  end

  # GET /measurements/new
  def new
    @measurement = Measurement.new
  end

  # GET /measurements/1/edit
  def edit
  end

  # POST /measurements
  def create
    @measurement = Measurement.new(measurement_params)

    if @measurement.save
      redirect_to @measurement, notice: 'Measurement was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /measurements/1
  def update
    if @measurement.update(measurement_params)
      redirect_to @measurement, notice: 'Measurement was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /measurements/1
  def destroy
    @measurement.destroy
    redirect_to measurements_url, notice: 'Measurement was successfully destroyed.'
  end

  def add_series
    series = Series.find(params[:series_id])
    if series.measurement_id == @measurement.id
      redirect_to edit_measurement_url(@measurement.id), notice: 'This series is already included!'
      return
    end
    @measurement.series << series
    respond_to do |format|
      format.html { redirect_to edit_measurement_url(@measurement.id) }
      format.js {}
    end
  end

  def remove_series
    respond_to do |format|
      format.js { render nothing: true, status: 200 }
    end
    series = Series.find(params[:series_id])
    if series.measurement_id == @measurement.id
      series.update! measurement_id: nil
    end
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_measurement
      @measurement = Measurement.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def measurement_params
      params.require(:measurement).permit(:prefix, :data_portal_name, :units_label, :units_label_short, :percent, :real, :notes, :unrestricted, :series_id)
    end
end

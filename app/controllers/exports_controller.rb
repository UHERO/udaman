class ExportsController < ApplicationController
  before_action :set_export, only: [:show, :show_table, :edit, :update, :destroy]

  # GET /exports
  def index
    @exports = Export.order(:name).all
  end

  # GET /exports/1
  # GET /exports/1.csv
  def show
    respond_to do |format|
      format.csv { render :layout => false }
      format.html # show.html.erb
    end
  end

  def show_table
    @series_to_chart = @export.series.pluck :name
    if @series_to_chart.length == 0
      render 'table'
    end
    frequency = @series_to_chart[0][-1]
    dates = set_dates(frequency, params)
    @start_date = 0
    @end_date = 9999
    render 'table'
  end

  # GET /exports/new
  def new
    @export = Export.new
  end

  # GET /exports/1/edit
  def edit
  end

  # POST /exports
  def create
    @export = Export.new(export_params)

    if @export.save
      redirect_to @export, notice: 'Export was successfully created.'
    else
      render :new
    end
  end

  # PATCH/PUT /exports/1
  def update
    if @export.update(export_params)
      redirect_to @export, notice: 'Export was successfully updated.'
    else
      render :edit
    end
  end

  # DELETE /exports/1
  def destroy
    @export.destroy
    redirect_to exports_url, notice: 'Export was successfully destroyed.'
  end
  
  def add_series
    @export = Export.find_by id: params[:id].to_i
    series = Series.find_by id: params[:series_id].to_i
    if @export.series.include?(series)
      redirect_to edit_export_url(@export.id), notice: 'This series is already in the list!'
      return
    end
    list_order = ExportSeries.where(export_id: @export.id).maximum(:list_order)
    list_order ||= 0
    @export.series<< series
    ExportSeries.find_by(export_id: @export.id, series_id: series.id).update(list_order: list_order + 1)
    respond_to do |format|
      format.html { redirect_to edit_export_url(@export.id) }
      format.js {}
    end
  end

  def move_series_up
    respond_to do |format|
      format.js { render nothing: true, status: 200 }
    end
    @export = Export.find_by id: params[:id]
    puts "trying to move series #{params[:series_id]} up."
    series_array = @export.export_series.to_a.sort_by{ |m| m.list_order }
    old_index = series_array.index{ |m| m.series_id == params[:series_id].to_i }
    if old_index <= 0
      return
    end
    series_array.each_index do |i|
      if old_index - 1 == i
        series_array[i].update list_order: i + 1
        next
      end
      if old_index == i
        series_array[i].update list_order: i - 1
        next
      end
      series_array[i].update list_order: i
    end
  end

  def move_series_down
    respond_to do |format|
      format.js { render nothing: true, status: 200 }
    end
    @export = Export.find_by id: params[:id]
    puts "trying to move series #{params[:series_id]} down."
    series_array = @export.export_series.to_a.sort_by{ |m| m.list_order }
    old_index = series_array.index{ |m| m.series_id == params[:series_id].to_i }
    if old_index >= series_array.length - 1
      return
    end
    series_array.each_index do |i|
      if old_index + 1 == i
        series_array[i].update list_order: i - 1
        next
      end
      if old_index == i
        series_array[i].update list_order: i + 1
        next
      end
      series_array[i].update list_order: i
    end
  end

  def remove_series
    respond_to do |format|
      format.js { render nothing: true, status: 200 }
    end
    series = ExportSeries.where(export_id: params[:id]).to_a.sort_by{ |m| m.list_order }
    index_to_remove = series.index{ |m| m.series_id == params[:series_id].to_i }
    new_order = 0
    series.each_index do |i|
      if index_to_remove == i
        next
      end
      series[i].update list_order: new_order
      new_order += 1
    end
    id_to_remove = ExportSeries.find_by(export_id: params[:id], series_id: params[:series_id]).id
    ExportSeries.destroy(id_to_remove)
  end

  private
    # Use callbacks to share common setup or constraints between actions.
    def set_export
      @export = Export.find(params[:id])
    end

    # Only allow a trusted parameter "white list" through.
    def export_params
      params.require(:export).permit(:name, :created_by, :updated_by, :owned_by)
    end

    def set_dates(frequency, params)
      case frequency
        when 'M', 'm'
          months_back = 15
          offset = 1
        when 'Q', 'q'
          months_back = 34
          offset = 4
        when 'A', 'a'
          months_back = 120
          offset = 4
        else
          return nil
      end

      if params[:num_years].nil?
        start_date = (Time.now.to_date << (months_back))
        end_date = nil
      else
        start_date = (Time.now.to_date << (12 * params[:num_years].to_i + offset))
        end_date = nil
      end
      {:start_date => start_date, :end_date => end_date}
    end
end

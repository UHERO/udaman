class ExportsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_export, only: [:show, :show_table, :edit, :update, :destroy,
                                    :edit_as_text, :save_as_text, :add_series, :remove_series, :move_series_up, :move_series_down]

  def index
    @exports = Export.order(:name).all
  end

  def show
    respond_to do |format|
      format.csv { render :layout => false }
      format.html # show.html.erb
    end
  end

  def show_table
    @series_to_chart = @export.series.pluck(:name)
    if @series_to_chart.length > 0
      @start_date = 0
      @end_date = 9999
    end
    render 'table'
  end

  def new
    @export = Export.new
  end

  def edit
  end

  def create
    @export = Export.new(export_params)

    if @export.save
      redirect_to @export, notice: 'Export was successfully created.'
    else
      render :new
    end
  end

  def update
    if @export.update(export_params)
      redirect_to @export, notice: 'Export was successfully updated.'
    else
      render :edit
    end
  end

  def destroy
    @export.destroy
    redirect_to exports_url, notice: 'Export was successfully destroyed.'
  end

  def edit_as_text
    @series_list = @export.export_series.order(:list_order).map {|es| es.series.name }.join("\n")
  end

  def save_as_text
    box_content = params[:edit_box].split(' ')
    @export.replace_all_series(box_content)
    redirect_to edit_export_url(@export)
  end

  def add_series
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

  def remove_series
    respond_to do |format|
      format.js { head :ok } ## only return 200 to client
    end
    series = ExportSeries.where(export_id: @export.id).to_a.sort_by{ |m| m.list_order }
    series_id = params[:series_id].to_i
    index_to_remove = series.index{ |m| m.series_id == series_id }
    new_order = 0
    series.each_index do |i|
      if index_to_remove == i
        next
      end
      series[i].update list_order: new_order
      new_order += 1
    end
    id_to_remove = ExportSeries.find_by(export_id: @export.id, series_id: series_id).id
    ExportSeries.destroy(id_to_remove)
  end

  def move_series_up
    respond_to do |format|
      format.js { head :ok } ## only return 200 to client
    end
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
      format.js { head :ok } ## only return 200 to client
    end
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

private
    # Use callbacks to share common setup or constraints between actions.
    def set_export
      @export = Export.find params[:id]
    end

    # Only allow a trusted parameter "white list" through.
    def export_params
      params.require(:export).permit(:name, :created_by, :updated_by, :owned_by)
    end
end

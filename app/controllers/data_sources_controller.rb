class DataSourcesController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_data_source, except: %i[new create]

  def source
    @data_source.reload_source
    redirect_to(
      series_path(@data_source.series_id),
      notice: "Successfully cleared datatable for #{@data_source.name}"
    )
  end

  def clear
  end

  def do_clear
    cutoff_date = clear_params[:date].nil_blank ## will be nil when all points are to be cleared
    delete_method_param = {}
    if cutoff_date
      if clear_params[:type].blank?
        redirect_to(
          clear_data_source_path(@data_source),
          notice: "Queued clearing of datatable for #{@data_source.name}"
        )
        return
      end
      delete_method_param = { clear_params[:type].to_sym => cutoff_date }
    end
    @data_source.delete_data_points(**delete_method_param) ## double splat for hash
    @data_source.series.repair_currents!
    @data_source.reset
    redirect_to(
      series_path(@data_source.series_id),
      notice: "Successfully did clear of datatable for #{@data_source.name}"
    )
  end

  def delete
    create_action @data_source, "DELETE" if @data_source.destroy
    redirect_to(
      series_path(@data_source.series_id),
      notice: "Successfully deleted datatable for #{@data_source.name}"
    )
  end

  def reset
    @data_source.reset
    redirect_to(
      series_path(@data_source.series_id),
      notice: "Successfully reset datatable for #{@data_source.name}"
    )
  end

  def disable
    @data_source.disable!
    redirect_to(
      series_path(@data_source.series_id),
      notice: "Successfully disabled datatable for #{@data_source.name}"
    )
  end

  def toggle_reload_nightly
    @data_source.toggle_reload_nightly
    redirect_to(
      series_path(@data_source.series_id),
      notice:
        "Successfully toggled reload nightly reload for #{@data_source.name}"
    )
  end

  def new
    @series = Series.find params[:series_id]
    @data_source = DataSource.new(series_id: @series.id)
  end

  def show
    redirect_to(series_path(@data_source.series_id))
  end

  def edit
    @disab = @data_source.disabled?
  end

  def update
    update_attrs = data_source_params
    eval_changed = (@data_source.eval != update_attrs[:eval].strip)
    ph_changed =
      (@data_source.pseudo_history? != update_attrs[:pseudo_history].to_bool)
    update_attrs[:scale] = update_attrs[:scale].to_f.to_s ## normalize the scaling factor format

    begin
      if @data_source.update!(update_attrs)
        @data_source.setup if eval_changed
        if ph_changed
          @data_source.mark_data_as_pseudo_history(@data_source.pseudo_history?)
        end
        create_action @data_source, "UPDATE"
        redirect_to(
          series_path(@data_source.series_id),
          notice: "Successfully updated auto reload for #{@data_source.name}"
        )
      else
        redirect_to(
          series_path(@data_source.series_id),
          notice: "Successfully updated auto reload for #{@data_source.name}"
        )
      end
    rescue StandardError => e
      flash[:alert] = "Error updating data source: #{e.message}"
      redirect_to edit_data_source_path(@data_source)
    end
  end

  def inline_update
    if @data_source.update_attributes(eval: data_source_params[:eval])
      create_action @data_source, "UPDATE"
      begin
        render(
          partial: "inline_edit",
          locals: {
            ds: @data_source,
            notice: "OK, (#{@data_source.series.aremos_diff})"
          }
        )
      rescue StandardError
        render(
          partial: "inline_edit",
          locals: {
            ds: @data_source,
            notice: "BROKE ON LOAD"
          }
        )
      end
    else
      render(
        partial: "inline_edit",
        locals: {
          ds: @data_source,
          notice: "BROKE ON SAVE"
        }
      )
    end
  end

  def create
    create_attrs = data_source_params
    create_attrs[:scale] = create_attrs[:scale].to_f.to_s ## normalize the scaling factor format

    @data_source = DataSource.new(create_attrs)
    begin
      if @data_source.create_from_form
        create_action @data_source.series.data_sources_by_last_run.first, "CREATE"
        redirect_to series_path(@data_source.series_id),
                    notice: "Successfully created #{@data_source.series.name}"
      else
        @series = Series.find_by id: @data_source.series_id
        render(action: "new", series_id: @data_source.series_id)
      end
    rescue StandardError => e
      @series = Series.find_by id: @data_source.series_id
      flash.now[:alert] = "Error creating data source: #{e.message}"
      render(action: "new", series_id: @data_source.series_id)
    end
  end

  private

  def set_data_source
    @data_source = DataSource.find params[:id]
  end

  def data_source_params
    params.require(:data_source).permit(
      :series_id,
      :eval,
      :priority,
      :scale,
      :color,
      :presave_hook,
      :pseudo_history,
      :clear_before_load
    )
  end

  def clear_params
    params.require(:clear_op).permit(:date, :type)
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

class DownloadsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_download, only: [:show, :edit, :update, :destroy, :download]

  def index
    @output_files = Download.order(:url).all
    @domain_hash = {}
    @output_files.each do |dsd|
      @domain_hash[dsd.url.split('/')[2]] ||= []
      @domain_hash[dsd.url.split('/')[2]].push dsd.handle
    end
  end

  def new
    @output_file = Download.new
  end

  def create
    post_params = params[:download].delete(:post_parameters)
    @output_file = Download.new download_params.map {|k,v| [k, v.blank? ? nil : v] }.to_h ## don't put empty strings in the db.
    if @output_file.save
      @output_file.process_post_params(post_params)
      redirect_to :action => 'index'
    else
      render :action => 'new'
    end
  end
  
  def update
    post_params = params[:download].delete(:post_parameters)
    respond_to do |format|
      if @output_file.update! download_params
        @output_file.process_post_params(post_params)

        format.html { redirect_to( :action => 'index', :notice => 'Download successfully updated.') }
        format.xml  { head :ok }
      else
        format.html { render :action => 'edit' }
        format.xml  { render :xml => @output_file.errors,
                      :status => :unprocessable_entity }
      end
    end
  end

  def destroy
    @output_file.destroy
    redirect_to :action => 'index'
  end
  
  def download
    respond_to do |format|
      begin
        @output_file.download 
        flash[:notice] = 'Download successfully updated.'
        format.html { redirect_to( :action => 'index') }
      rescue Exception => e
        flash[:notice] = "Something went wrong: #{e.message}"
        format.html { redirect_to( :action => 'index') }
      end
    end
  end
  
  def test_url
    @test_url_status = Download.test_url(URI.encode(params[:change_to]))
    render :partial => 'download_test_results'
  end

  def test_save_path
    @test_save_path = Download.test_save_path(params[:change_to])
    render :partial => 'save_location_test_results'
  end
  
  def test_post_params
    @test_post_params = Download.test_post_params(params[:change_to])
    render :partial => 'parameter_formatting_test_results'
  end

  private
  def download_params
    params.require(:download).permit(:handle, :url, :filename_ext, :file_to_extract, :sheet_override, :post_parameters, :notes)
  end

  def set_download
    @output_file = Download.find_by id: params[:id]
  end

end

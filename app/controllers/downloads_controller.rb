class DownloadsController < ApplicationController
  include Authorization

  before_action :check_authorization
  before_action :set_download, only: [:show, :edit, :duplicate, :update, :destroy, :download]

  def index
    @output_files = Download.order(handle: :asc).all   ## this instance var name is outrageously stupid - CHANGE IT
    @domain_hash = get_handles_per_domain(@output_files)
  end

  def by_pattern
    @output_files = Download.get(params[:pat], :time)
    @domain_hash = get_handles_per_domain(@output_files)
    render :index
  end

  def new
    @output_file = Download.new
  end

  def duplicate
    @output_file = @output_file.dup
    @output_file.assign_attributes(last_download_at: nil, last_change_at: nil, freeze_file: nil, notes: nil)
    render :edit
  end

  def show
  end

  def edit
  end

  def create
    myparams = download_params
    myparams[:freeze_file] = nil unless myparams[:freeze_file] == '1'  ## convert false to null in db
    post_params = myparams.delete(:post_parameters)
    @output_file = Download.new(myparams)
    if @output_file.save!
      @output_file.process_post_params(post_params)
      redirect_to :action => 'index'
    else
      render :action => 'new'
    end
  end
  
  def update
    myparams = download_params
    myparams[:freeze_file] = nil unless myparams[:freeze_file] == '1'  ## convert false to null in db
    post_params = myparams.delete(:post_parameters)
    respond_to do |format|
      if @output_file.update! myparams
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

  def pull_file
    path = params[:path]
    path.gsub!('..', '')  ## don't let users go "up" and outside the path root restriction
    send_file File.join(ENV['DATA_PATH'], path)  ## only extract files under the DATA_PATH!
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
    params.require(:download).permit(:handle, :url, :freeze_file, :filename_ext, :file_to_extract, :sheet_override,
                                     :sort1, :sort2, :post_parameters, :notes)
  end

  def set_download
    @output_file = Download.find params[:id]   ### this instance var name is outrageously stupid - CHANGE IT
  end

  def get_handles_per_domain(downloads)
    hash = {}
    downloads.each do |dl|
      next if dl.url.nil?
      domain = dl.url.split('/')[2].split(':')[0]  ## super hacky and awful but basically works
      hash[domain] ||= []  ## initialize empty array here if not already existing
      hash[domain].push(dl.handle)
    end
    hash
  end
end
